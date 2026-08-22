from PIL import Image
import sys

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

def analyze_screenshot(path, name):
    try:
        img = Image.open(path)
        w, h = img.size
        print(f"\n=== {name} ===")
        print(f"Size: {w}x{h}")
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        regions = {
            'top_sky': (0, 0, w, h//3),
            'mid_horizon': (0, h//3, w, 2*h//3),
            'ground': (0, 2*h//3, w, h)
        }
        
        for region_name, (x1, y1, x2, y2) in regions.items():
            crop = img.crop((x1, y1, x2, y2))
            pixels = list(crop.getdata())
            avg_r = sum(p[0] for p in pixels) / len(pixels)
            avg_g = sum(p[1] for p in pixels) / len(pixels)
            avg_b = sum(p[2] for p in pixels) / len(pixels)
            brightness = (avg_r + avg_g + avg_b) / 3
            print(f"  {region_name}: RGB({avg_r:.1f}, {avg_g:.1f}, {avg_b:.1f}) brightness={brightness:.1f}")
        
        pixels = list(img.getdata())
        avg_r = sum(p[0] for p in pixels) / len(pixels)
        avg_g = sum(p[1] for p in pixels) / len(pixels)
        avg_b = sum(p[2] for p in pixels) / len(pixels)
        
        variance = sum((p[0]-avg_r)**2 + (p[1]-avg_g)**2 + (p[2]-avg_b)**2 for p in pixels) / len(pixels)
        print(f"  overall_color_variance: {variance:.1f}")
        
        # Check for rectangular artifacts by looking at edge transparency/brightness
        # Sample vertical strips at left, center, right
        strips = {
            'left_edge': (0, 0, w//10, h),
            'center': (w//3, 0, 2*w//3, h),
            'right_edge': (9*w//10, 0, w, h)
        }
        
        for strip_name, (x1, y1, x2, y2) in strips.items():
            crop = img.crop((x1, y1, x2, y2))
            pixels = list(crop.getdata())
            avg_r = sum(p[0] for p in pixels) / len(pixels)
            avg_g = sum(p[1] for p in pixels) / len(pixels)
            avg_b = sum(p[2] for p in pixels) / len(pixels)
            brightness = (avg_r + avg_g + avg_b) / 3
            print(f"  {strip_name}: RGB({avg_r:.1f}, {avg_g:.1f}, {avg_b:.1f}) brightness={brightness:.1f}")
        
        return variance
    except Exception as e:
        print(f"Error analyzing {name}: {e}")
        return 0

v1 = analyze_screenshot('E:/pokigame/screenshot_clouds_initial.png', 'INITIAL')
v2 = analyze_screenshot('E:/pokigame/screenshot_clouds_8s.png', 'AFTER_8S')

print(f"\n=== COMPARISON ===")
print(f"Initial variance: {v1:.1f}")
print(f"After 8s variance: {v2:.1f}")
if v2 > v1 * 0.9:
    print("Variance maintained - sky/clouds likely visible")
else:
    print("Variance decreased significantly")
