from PIL import Image
import sys

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

def analyze_phase(path, name):
    try:
        img = Image.open(path)
        w, h = img.size
        if img.mode != 'RGB':
            img = img.convert('RGB')
        print(f"\n=== {name} ===")
        # grid analysis for uniform haze / rectangles
        cols, rows = 10, 8
        cw, ch = w // cols, h // rows
        low = []
        for r in range(rows):
            for c in range(cols):
                crop = img.crop((c*cw, r*ch, (c+1)*cw, (r+1)*ch))
                pixels = list(crop.getdata())
                avg = [sum(p[i] for p in pixels)/len(pixels) for i in range(3)]
                var = sum((p[0]-avg[0])**2 + (p[1]-avg[1])**2 + (p[2]-avg[2])**2 for p in pixels) / len(pixels)
                if var < 180:
                    low.append(f"({c},{r}) var={var:.0f} b={(avg[0]+avg[1]+avg[2])/3:.0f}")
        if low:
            print(f"  low-var cells: {len(low)}")
            for x in low[:8]:
                print("   ", x)
        else:
            print("  no low-var cells")
        # overall variance
        pixels = list(img.getdata())
        avg = [sum(p[i] for p in pixels)/len(pixels) for i in range(3)]
        var = sum((p[0]-avg[0])**2 + (p[1]-avg[1])**2 + (p[2]-avg[2])**2 for p in pixels) / len(pixels)
        print(f"  overall variance: {var:.0f}")
        # edges
        for edge, box in [('left',(0,0,w//8,h)),('right',(7*w//8,0,w,h)),('top',(0,0,w,h//8)),('bottom',(0,7*h//8,w,h))]:
            crop = img.crop(box)
            pixels = list(crop.getdata())
            avg = [sum(p[i] for p in pixels)/len(pixels) for i in range(3)]
            print(f"  {edge} brightness: {(avg[0]+avg[1]+avg[2])/3:.1f}")
    except Exception as e:
        print(f"Error {name}: {e}")

for phase in ['day','sunset','night','dawn']:
    analyze_phase(f'E:/pokigame/screenshot_cloud_v2_{phase}.png', phase.upper())
