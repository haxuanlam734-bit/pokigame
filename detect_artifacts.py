from PIL import Image
import sys

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

def detect_rectangular_artifacts(path, name):
    try:
        img = Image.open(path)
        w, h = img.size
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        print(f"\n=== {name} ===")
        
        # Divide image into grid cells and compute variance in each
        grid_cols = 8
        grid_rows = 6
        cell_w = w // grid_cols
        cell_h = h // grid_rows
        
        low_variance_cells = []
        uniform_color_cells = []
        
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
                
                variance = sum((p[0]-avg_r)**2 + (p[1]-avg_g)**2 + (p[2]-avg_b)**2 for p in pixels) / len(pixels)
                
                # A uniform translucent rectangle would have very low variance
                # and colors close to the background
                if variance < 200:
                    low_variance_cells.append(f"  Cell({col},{row}): var={variance:.0f} RGB({avg_r:.0f},{avg_g:.0f},{avg_b:.0f})")
                
                # Check for cells that are suspiciously uniform and bright
                # (like a white haze rectangle)
                brightness = (avg_r + avg_g + avg_b) / 3
                if variance < 300 and brightness > 150:
                    uniform_color_cells.append(f"  Cell({col},{row}): var={variance:.0f} bright={brightness:.0f}")
        
        if low_variance_cells:
            print(f"  Low variance cells (<200): {len(low_variance_cells)}")
            for cell in low_variance_cells[:10]:
                print(cell)
        else:
            print("  No low variance cells detected (good)")
        
        if uniform_color_cells:
            print(f"  Uniform bright cells (<300 var, >150 bright): {len(uniform_color_cells)}")
            for cell in uniform_color_cells[:10]:
                print(cell)
        else:
            print("  No uniform bright haze cells detected (good)")
        
        # Check for horizontal banding (rectangular planes often create horizontal bands)
        # Compute variance for each horizontal scanline
        scanline_variances = []
        for y in range(0, h, 10):
            line_pixels = [img.getpixel((x, y)) for x in range(0, w, 10)]
            avg_r = sum(p[0] for p in line_pixels) / len(line_pixels)
            avg_g = sum(p[1] for p in line_pixels) / len(line_pixels)
            avg_b = sum(p[2] for p in line_pixels) / len(line_pixels)
            variance = sum((p[0]-avg_r)**2 + (p[1]-avg_g)**2 + (p[2]-avg_b)**2 for p in line_pixels) / len(line_pixels)
            scanline_variances.append(variance)
        
        # If there are rectangular planes, we'd see consistent low-variance horizontal bands
        min_var = min(scanline_variances)
        max_var = max(scanline_variances)
        avg_var = sum(scanline_variances) / len(scanline_variances)
        print(f"  Scanline variance: min={min_var:.0f}, max={max_var:.0f}, avg={avg_var:.0f}")
        
        if min_var < 100 and max_var > 1000:
            print("  WARNING: Large variance gap may indicate rectangular artifacts")
        else:
            print("  Scanline variance looks natural")
        
        return True
    except Exception as e:
        print(f"Error analyzing {name}: {e}")
        return False

detect_rectangular_artifacts('E:/pokigame/screenshot_clouds_initial.png', 'INITIAL')
detect_rectangular_artifacts('E:/pokigame/screenshot_clouds_8s.png', 'AFTER_8S')
