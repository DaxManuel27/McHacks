from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import tempfile
import os
import google.generativeai as genai
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required. Create a .env file with GEMINI_API_KEY=your_key")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp')


class PromptRequest(BaseModel):
    prompt: str
    current_code: Optional[str] = None
    current_stl_data: Optional[str] = None
    mesh_transforms: Optional[dict] = None
    component_transforms: Optional[list] = None


class GenerateResponse(BaseModel):
    stl_data: bytes
    openscad_code: str


def fix_common_syntax_errors(code: str) -> str:
    import re
    import math
    
    if 'PI' in code and 'PI =' not in code and 'PI=' not in code:
        code = f"PI = {math.pi};\n\n" + code
    
    lines = code.split('\n')
    fixed_lines = []
    
    for line in lines:
        if line.strip().startswith('module ') and '(' in line:
            fixed_lines.append(line)
            continue
        
        if 'gear_module' not in line and 'gear_mod' not in line:
            line = re.sub(r'\bmodule\s*=\s*', 'mod = ', line)
            line = re.sub(r'([*/+\-])\s*module\b', r'\1 mod', line)
            line = re.sub(r'\bmodule\s*([*/+\-])', r'mod \1', line)
        
        fixed_lines.append(line)
    
    return '\n'.join(fixed_lines)


def compile_openscad(openscad_code: str) -> tuple[bytes, str, str]:
    fixed_code = fix_common_syntax_errors(openscad_code)
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.scad', delete=False) as scad_file:
        scad_path = scad_file.name
        scad_file.write(fixed_code)
    
    stl_path = tempfile.mktemp(suffix='.stl')
    
    try:
        result = subprocess.run(
            ['openscad', scad_path, '-o', stl_path],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            return None, fixed_code, result.stderr
        
        if not os.path.exists(stl_path) or os.path.getsize(stl_path) == 0:
            return None, fixed_code, "OpenSCAD did not produce output"
        
        with open(stl_path, 'rb') as stl_file:
            stl_data = stl_file.read()
        
        return stl_data, fixed_code, ""
    
    except subprocess.TimeoutExpired:
        return None, fixed_code, "OpenSCAD compilation timed out (>60s). The model may be too complex. Try simplifying your request."
    
    finally:
        if os.path.exists(scad_path):
            os.unlink(scad_path)
        if os.path.exists(stl_path):
            os.unlink(stl_path)


@app.post("/generate")
async def generate_from_prompt(request: PromptRequest):
    max_retries = 2
    is_refinement = hasattr(request, 'current_code') and request.current_code
    
    for attempt in range(max_retries + 1):
        try:
            if attempt == 0:
                if is_refinement:
                    transforms_info = ""
                    
                    if hasattr(request, 'component_transforms') and request.component_transforms:
                        transforms_info = "EXISTING COMPONENTS:\n"
                        for idx, comp in enumerate(request.component_transforms):
                            comp_id = comp.get('id', f'component-{idx+1}')
                            pos = comp.get('position', {})
                            scale = comp.get('scale', {})
                            rot = comp.get('rotation', {})
                            transforms_info += f"""
{comp_id}:
  Position: X={pos.get('x', 0)}mm, Y={pos.get('y', 0)}mm, Z={pos.get('z', 0)}mm
  Scale: X={scale.get('x', 1)}, Y={scale.get('y', 1)}, Z={scale.get('z', 1)}
  Rotation: X={rot.get('x', 0)}°, Y={rot.get('y', 0)}°, Z={rot.get('z', 0)}°
"""
                    elif hasattr(request, 'mesh_transforms') and request.mesh_transforms:
                        transforms = request.mesh_transforms
                        pos = transforms.get('position', {})
                        scale = transforms.get('scale', {})
                        rot = transforms.get('rotation', {})
                        transforms_info = f"""
CURRENT OBJECT TRANSFORMS:
- Position: X={pos.get('x', 0)}mm, Y={pos.get('y', 0)}mm, Z={pos.get('z', 0)}mm
- Scale: X={scale.get('x', 1)}, Y={scale.get('y', 1)}, Z={scale.get('z', 1)}
- Rotation: X={rot.get('x', 0)}°, Y={rot.get('y', 0)}°, Z={rot.get('z', 0)}°
"""
                    
                    prompt_text = f"""You are an expert OpenSCAD programmer tasked with REFINING existing code.

IMPORTANT: You are modifying an existing model. ONLY change what is mentioned in the new request.
Preserve everything else. Do NOT regenerate the entire model unless explicitly asked.

{transforms_info}

Current code:
```
{request.current_code}
```

New request: {request.prompt}

POSITIONING RULES FOR MULTI-PART OBJECTS:
- When adding new parts, position them RELATIVE to existing component positions
- Use translate() to offset new parts from existing ones
- Consider existing component transforms when calculating new part positions
- If prompt says "add X on top of [component]", position above that component
- If prompt says "add X next to [component]", position beside that component
- If prompt says "connect X to [component]", align them appropriately

RULES FOR REFINEMENT:
1. Keep existing code structure and logic
2. ONLY modify/add what the request mentions
3. If asking to 'add', insert new parts without removing old ones
4. Preserve all existing geometry and components
3. If asking to "add", insert new parts without removing old ones
4. If asking to "change", modify ONLY those specific parts
5. If asking to "remove", comment out or delete ONLY those parts
6. Preserve all working code that isn't mentioned

SYNTAX RULES (CRITICAL):
- Return ONLY OpenSCAD code, no markdown or backticks
- All variables must be assigned before use
- Each statement must end with semicolon ;
- Maintain the same style and structure as the current code

Refactored OpenSCAD code (with refinements applied):"""
                else:
                    prompt_text = f"""You are an expert OpenSCAD programmer. Generate SIMPLE, working OpenSCAD code.

USER REQUEST: {request.prompt}

ALLOWED FUNCTIONS - USE ONLY THESE:
✓ cube([x, y, z], center=true or false)
✓ sphere(r=radius)
✓ cylinder(h=height, r=radius, center=true or false)
✓ polygon(points=[[x,y], [x,y], ...]) - for 2D shapes only
✓ linear_extrude(height=h) - to turn 2D polygons into 3D
✓ translate([x, y, z]) with content
✓ rotate([x, y, z]) with content
✓ scale([x, y, z]) with content
✓ union() with content
✓ difference() with content

FORBIDDEN SHAPES - NEVER USE:
❌ pyramid, cone, wedge, torus, polyhedron()
❌ hull(), minkowski(), rotate_extrude()
❌ circle(), square(), text()
❌ multmatrix(), mirror(), children(), child()
❌ ANY custom/complex polygon shapes (stick to triangles and rectangles only)

CRITICAL RULES - FOLLOW EXACTLY:

1. ONLY BASIC PRIMITIVES AND SIMPLE EXTRUSIONS:
   - Generate ONLY from: CUBES, SPHERES, CYLINDERS, TRIANGLES (via linear_extrude + polygon)
   - Combine them with translate(), rotate(), scale()
   - Use union() to combine shapes
   - Use difference() ONLY to subtract cylinders or cubes from other shapes
   - For TRIANGLES: use polygon(points=[[x,y], [x,y], [x,y]]) inside linear_extrude(height=h)
   - Maximum 15 lines of code
   - NO module definitions, NO functions, NO loops, NO conditionals

2. DIMENSIONS (MILLIMETERS):
   - Small parts: 5-50mm
   - Medium parts: 50-200mm  
   - Large parts: 200-500mm
   - DO NOT use sizes > 500mm or < 1mm
   - Round numbers only (10, 25, 50, not 10.5)

3. CODE STRUCTURE:
   - Start with: $fn = 50;
   - Define all variables at top (if needed)
   - One main shape or union() statement at end
   - Every line must end with semicolon (;)

4. EXAMPLES OF GOOD CODE:

Example 1 - Simple Cube:
$fn = 50;
cube([20, 20, 20], center=true);

Example 2 - Sphere:
$fn = 50;
sphere(r=15);

Example 3 - Cylinder:
$fn = 50;
cylinder(h=30, r=10, center=false);

Example 4 - Multi-part assembly (cubes + sphere):
$fn = 50;
cube([30, 30, 30], center=true);
translate([50, 0, 0]) sphere(r=15);

Example 5 - Triangular prism (triangle extruded):
$fn = 50;
linear_extrude(height=20)
  polygon(points=[[0,0], [30,0], [15,26]]);

Example 6 - Difference (cube with hole):
$fn = 50;
difference() {{
  cube([40, 40, 40], center=true);
  cylinder(h=50, r=8, center=true);
}}

RULES TO PREVENT ERRORS:
1. Always use center=true or center=false explicitly
2. Every variable must be defined before use
3. Every opening brace must have a matching closing brace
4. Every opening bracket must have a matching closing bracket
5. NO undefined or misspelled function names
6. If user asks for something OTHER than cube/sphere/cylinder, SUBSTITUTE the closest primitive
   - Prism => Use cube or linear_extrude with polygon for triangular prism
   - Cone => Use cylinder (cone not available)
   - Box => Use cube
   - Ball => Use sphere
   - Tube => Use cylinder with difference
   - Triangle => Use polygon inside linear_extrude
   - Pyramid => Use cube or stacked shapes
   - Wedge => Use rotated cube or cylinder

RETURN ONLY the OpenSCAD code. No markdown, no backticks, no explanations."""
            else:
                refinement_note = " (refinement)" if is_refinement else ""
                prompt_text = f"""The previous OpenSCAD code had a compilation error{refinement_note}. FIX IT NOW.

Original request: {request.prompt}

Previous code:
{openscad_code}

Compilation error:
{compilation_error}

FIX IMMEDIATELY:
1. Remove any complex math (PI, sin, cos, tan, sqrt)
2. Remove any for loops or conditionals
3. Remove any undefined variables
4. Remove any module definitions
5. Remove any polyhedron() or polygon()
6. Ensure all shapes have center=true or center=false explicitly
7. Check all translate/rotate/scale parameters are numbers
8. Make sure EVERY line ends with semicolon ;

REWRITE the code keeping it SIMPLE:
- Only cube(), sphere(), cylinder()
- Only translate(), rotate(), scale(), union(), difference()
- Maximum 15 lines
- All dimensions 1-500mm
- $fn = 50 at top

Return ONLY corrected OpenSCAD code, no explanations."""

            response = model.generate_content(prompt_text)
            openscad_code = response.text.strip()
            
            if openscad_code.startswith("```"):
                lines = openscad_code.split("\n")
                openscad_code = "\n".join(lines[1:-1]) if len(lines) > 2 else openscad_code
                openscad_code = openscad_code.replace("```openscad", "").replace("```", "").strip()
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Gemini API error: {str(e)}"
            )
        
        stl_data, fixed_code, compilation_error = compile_openscad(openscad_code)
        
        if stl_data:
            import base64
            response_data = {
                "stl_data": base64.b64encode(stl_data).decode('utf-8'),
                "openscad_code": fixed_code
            }
            return response_data
        
        openscad_code = fixed_code
        
        if attempt < max_retries:
            continue
        else:
            raise HTTPException(
                status_code=400,
                detail=f"OpenSCAD compilation failed after {max_retries + 1} attempts:\n{compilation_error}\n\nFinal generated code:\n{openscad_code}"
            )


@app.get("/health")
async def health():
    return {"status": "ok"}
