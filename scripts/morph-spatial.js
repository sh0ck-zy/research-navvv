import fs from 'node:fs';
import path from 'node:path';

// Goal: Make the distribution much more organic, continuous, less "perfect separate bubbles"
// Add some noise, stretch along X/Z plane to form a "band"

const targetPath = path.resolve(import.meta.dirname, '../apps/web/public/demo/nodes.json');
console.log(`Reading dataset from ${targetPath}`);

const data = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));

for (const node of data) {
    // 1. Add some organic noise to break perfect circular clustering
    const noiseX = (Math.random() - 0.5) * 12;
    const noiseY = (Math.random() - 0.5) * 6;
    const noiseZ = (Math.random() - 0.5) * 12;

    node.x += noiseX;
    node.y += noiseY;
    node.z += noiseZ;

    // 2. Compress the Y axis strongly so it feels more like a disk/band
    node.y *= 0.35;

    // 3. Stretch the X axis slightly to give a directional galaxy shape
    node.x *= 1.4;

    // 4. If perfectly 0,0,0 or very close (often centroids), scatter them mildly
    const dist = Math.hypot(node.x, node.y, node.z);
    if (dist < 5) {
        node.x += (Math.random() - 0.5) * 20;
        node.z += (Math.random() - 0.5) * 20;
    }
}

fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
console.log('Dataset modified for organic spatial distribution.');

