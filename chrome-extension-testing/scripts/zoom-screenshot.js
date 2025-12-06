/**
 * Screenshot Zoom Utility
 * Crops and scales a region of a screenshot for detailed inspection.
 *
 * Usage:
 *   node zoom-screenshot.js <input.png> <x> <y> <width> <height> <output.png>
 *
 * Example:
 *   node zoom-screenshot.js screenshot.png 300 200 400 300 zoomed.png
 *
 * This extracts a 400x300 region starting at (300,200) and saves it at 2x scale.
 */

const sharp = require('sharp');

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 6) {
    console.log('Usage: node zoom-screenshot.js <input.png> <x> <y> <width> <height> <output.png>');
    console.log('');
    console.log('Arguments:');
    console.log('  input.png  - Source screenshot file');
    console.log('  x          - Left coordinate of crop region');
    console.log('  y          - Top coordinate of crop region');
    console.log('  width      - Width of crop region');
    console.log('  height     - Height of crop region');
    console.log('  output.png - Destination file (will be 2x scaled)');
    console.log('');
    console.log('Example:');
    console.log('  node zoom-screenshot.js test-reports/01_modal.png 370 250 530 400 modal-zoomed.png');
    process.exit(1);
  }

  const [inputPath, x, y, width, height, outputPath] = args;

  try {
    await sharp(inputPath)
      .extract({
        left: parseInt(x),
        top: parseInt(y),
        width: parseInt(width),
        height: parseInt(height)
      })
      .resize(parseInt(width) * 2, parseInt(height) * 2, { kernel: 'nearest' })
      .toFile(outputPath);

    console.log(`Zoomed image saved to: ${outputPath}`);
    console.log(`  Region: (${x}, ${y}) ${width}x${height}`);
    console.log(`  Output: ${parseInt(width) * 2}x${parseInt(height) * 2} (2x scale)`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
