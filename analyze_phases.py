from PIL import Image
import sys

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

def analyze_phase_screenshot(path, name):
    try:
        img = Image.open(path)
        w, h = img.size
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        print(f"\n=== {name} ===")
        
        # Grid analysis
        grid_cols = 10
        grid_rows = 8
        cell_w = w // grid_cols
        cell_h = h // grid_rows
        
        suspicious_cells = []
        for row in range(grid_rows):
            for col in range(grid_cols):
                x1 = col * cell_w
                y1 = row * cell_h
                x2 = x1 + cell_w
                y2 = y1 + cell_h
                crop = img.crop((x1, y1, x2, y2))
                pixels = list(crop.getdata())
                
                avg_r = sum(p[0] for p in pixels) / len(pixels)
                avg_g = sum(p[1] for p in pixels) / len(pixels)
                avg_b = sum(p[2] for p in pixels) / len(pixels)
                brightness = (avg_r + avg_g + avg_b) / 3
                
                variance = sum((p[0]-avg_r)**2 + (p[1]-avg_g)**2 + (p[2]-avg_b)**2 for p in pixels) / len(pixels)
                
                if variance < 150:
                    suspicious_cells.append(f"  ({col},{row}): var={variance:.0f} bright={brightness:.0f}")
        
        if suspicious_cells:
            print(f"  Very low variance cells (<150): {len(suspicious_cells)}")
            for cell in suspicious_cells[:8]:
                print(cell)
        else:
            print("  No suspicious uniform cells (good)")
        
        # Check overall variance
        pixels = list(img.getdata())
        avg_r = sum(p[0] for p in pixels) / len(pixels)
        avg_g = sum(p[1] for p in pixels) / len(pixels)
        avg_b = sum(p[2] for p in pixels) / len(pixels)
        variance = sum((p[0]-avg_r)**2 + (p[1]-avg_g)**2 + (p[2]-avg_b)**2 for p in pixels) / len(pixels)
        print(f"  Overall variance: {variance:.0f}")
        
        # Edge analysis
        edges = {
            'left': (0, 0, w//8, h),
            'right': (7*w//8, 0, w, h),
            'top': (0, 0, w, h//8),
            'bottom': (0, 7*h//8, w, h)
        }
        for edge_name, (x1, y1, x2, y2) in edges.items():
            crop = img.crop((x1, y1, x2, y2))
            pixels = list(crop.getdata())
            avg_r = sum(p[0] for p in pixels) / len(pixels)
            avg_g = sum(p[1] for p in pixels) / len(pixels)
            avg_b = sum(p[2] for p in pixels) / len(pixels)
            brightness = (avg_r + avg_g + avg_b) / 3
            print(f"  {edge_name} edge brightness: {brightness:.1f}")
        
        return variance
    except Exception as e:
        print(f"Error: {e}")
        return 0

phases = ['day', 'sunset', 'night', 'dawn']
for phase in phases:
    analyze_phase_screenshot(f'E:/pokigame/screenshot_phase_{phase}.png', phase.upper())
