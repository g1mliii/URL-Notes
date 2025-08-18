#!/usr/bin/env python3
"""Create placeholder icons for the URL Notes extension"""

import os
from PIL import Image, ImageDraw

def create_icon(size):
    """Create a simple icon with the specified size"""
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded rectangle background
    margin = max(1, size // 8)
    draw.rounded_rectangle(
        [margin, margin, size-margin, size-margin],
        radius=max(2, size // 6),
        fill=(0, 122, 255, 255)  # iOS blue
    )
    
    # Draw note icon
    note_margin = max(2, size // 4)
    note_width = size - (note_margin * 2)
    note_height = int(note_width * 0.8)
    note_x = note_margin
    note_y = (size - note_height) // 2
    
    # Note background
    draw.rectangle(
        [note_x, note_y, note_x + note_width, note_y + note_height],
        fill=(255, 255, 255, 255)
    )
    
    # Note lines (for larger icons)
    if size >= 32:
        line_height = max(1, size // 16)
        line_spacing = max(2, size // 8)
        line_width = int(note_width * 0.7)
        line_x = note_x + int(note_width * 0.15)
        
        for i in range(3):
            line_y = note_y + int(note_height * 0.3) + (i * line_spacing)
            if line_y + line_height < note_y + note_height:
                draw.rectangle(
                    [line_x, line_y, line_x + line_width, line_y + line_height],
                    fill=(0, 122, 255, 255)
                )
    
    return img

def main():
    # Create icons directory
    icons_dir = os.path.join('extension', 'assets', 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    
    # Create all required icon sizes
    sizes = [16, 32, 48, 128]
    
    for size in sizes:
        try:
            icon = create_icon(size)
            icon_path = os.path.join(icons_dir, f'icon{size}.png')
            icon.save(icon_path, 'PNG')
            print(f'✓ Created icon{size}.png')
        except Exception as e:
            print(f'✗ Failed to create icon{size}.png: {e}')
    
    print(f'\nIcons saved to: {os.path.abspath(icons_dir)}')

if __name__ == '__main__':
    main()
