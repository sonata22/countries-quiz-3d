// Instant WASD rotation on keydown (in addition to smooth animation)
document.addEventListener('keydown', function(e) {
    if (!globe.globeGroup) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key && e.key.toLowerCase();
    const rotationStep = 0.012;
    if (key === 'a') {
        globe.globeGroup.rotateY(rotationStep);
    } else if (key === 'd') {
        globe.globeGroup.rotateY(-rotationStep);
    } else if (key === 'w') {
        globe.globeGroup.rotateX(-rotationStep);
    } else if (key === 's') {
        globe.globeGroup.rotateX(rotationStep);
    }
    // R: reset view
    if (key === 'r') {
        globe.globeGroup.rotation.set(0, 0, 0);
        if (globe.controls) {
            globe.controls.target.set(0, 0, 0);
            globe.controls.update();
        }
    }
});
// --- Smooth WASD animation ---
const pressedKeys = { w: false, a: false, s: false, d: false };
let wasdAnimationActive = false;
let velocityY = 0, velocityX = 0;
const maxVelocity = 0.04; // max radians/frame
const acceleration = 0.012; // how fast to accelerate
const damping = 0.15; // how quickly to slow down

function animateWASDRotation() {
    if (!wasdAnimationActive) {
        wasdAnimationActive = true;
        requestAnimationFrame(wasdStep);
    }
}

function wasdStep() {
    // Determine target velocities
    let targetY = 0, targetX = 0;
    if (pressedKeys.a) targetY += maxVelocity;
    if (pressedKeys.d) targetY -= maxVelocity;
    if (pressedKeys.w) targetX -= maxVelocity;
    if (pressedKeys.s) targetX += maxVelocity;

    // Smoothly interpolate velocity toward target
    velocityY += (targetY - velocityY) * acceleration;
    velocityY *= (1 - damping);
    velocityX += (targetX - velocityX) * acceleration;
    velocityX *= (1 - damping);

    // Apply rotation
    if (Math.abs(velocityY) > 0.0001) {
        globe.globeGroup.rotateY(velocityY);
    }
    if (Math.abs(velocityX) > 0.0001) {
        globe.globeGroup.rotateX(velocityX);
    }

    // Continue animation if any velocity or key is active
    if (pressedKeys.a || pressedKeys.d || pressedKeys.w || pressedKeys.s || Math.abs(velocityY) > 0.0001 || Math.abs(velocityX) > 0.0001) {
        requestAnimationFrame(wasdStep);
    } else {
        wasdAnimationActive = false;
        velocityY = 0;
        velocityX = 0;
    }
}

document.addEventListener('keydown', function(e) {
    if (!globe.globeGroup) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key && e.key.toLowerCase();
    if (['w','a','s','d'].includes(key)) {
        // Only start animation if no WASD key was previously pressed
        const wasAnyPressed = pressedKeys.w || pressedKeys.a || pressedKeys.s || pressedKeys.d;
        pressedKeys[key] = true;
        if (!wasAnyPressed) {
            animateWASDRotation();
        }
    }
    // R: reset view
    if (key === 'r') {
        globe.globeGroup.rotation.set(0, 0, 0);
        if (globe.controls) {
            globe.controls.target.set(0, 0, 0);
            globe.controls.update();
        }
    }
});

document.addEventListener('keyup', function(e) {
    const key = e.key && e.key.toLowerCase();
    if (['w','a','s','d'].includes(key)) {
        pressedKeys[key] = false;
    }
});
// Minimal Globe rendering with Three.js
class Globe {
    drawCountryBorders(feature, color = 0xcccccc) {
        const coords = feature.geometry.type === 'Polygon'
            ? feature.geometry.coordinates
            : feature.geometry.coordinates.flat();
        coords.forEach(ring => {
            const points = ring.map(([lng, lat]) => {
                const latRad = lat * Math.PI / 180;
                const lngRad = -lng * Math.PI / 180;
                const radius = 1.01;
                return new THREE.Vector3(
                    Math.cos(latRad) * Math.cos(lngRad) * radius,
                    Math.sin(latRad) * radius,
                    Math.cos(latRad) * Math.sin(lngRad) * radius
                );
            });
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color });
            this.borderGroup.add(new THREE.Line(geometry, material));
        });
    }
    constructor(containerId = 'globe-container', canvasId = 'globe-canvas') {
        // Create scene and globeGroup only once
        this.scene = new THREE.Scene();
        this.globeGroup = new THREE.Group();
        this.scene.add(this.globeGroup);



        // Add global axes to scene (always visible)
        this.globalAxesGroup = new THREE.Group();
        const axes = [
            { dir: new THREE.Vector3(1,0,0), color: 0xff0000, label: 'X+', negLabel: 'X-' }, // latitude (red)
            { dir: new THREE.Vector3(0,1,0), color: 0x00ff00, label: 'Y+', negLabel: 'Y-' }, // longitude (green)
            { dir: new THREE.Vector3(0,0,1), color: 0x0000ff, label: 'Z+', negLabel: 'Z-' } // z (blue)
        ];
        axes.forEach(axis => {
            const start = axis.dir.clone().multiplyScalar(-5);
            const end = axis.dir.clone().multiplyScalar(5);
            const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
            const lineMat = new THREE.LineBasicMaterial({ color: axis.color });
            const line = new THREE.Line(lineGeo, lineMat);
            this.globalAxesGroup.add(line);
            // Add labels at both ends
            const makeLabel = (text, position, color) => {
                const canvas = document.createElement('canvas');
                canvas.width = 128;
                canvas.height = 32;
                const ctx = canvas.getContext('2d');
                ctx.font = 'bold 20px Arial';
                ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
                ctx.fillText(text, 10, 24);
                const texture = new THREE.CanvasTexture(canvas);
                const spriteMat = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.position.copy(position);
                sprite.scale.set(0.5, 0.15, 1);
                return sprite;
            };
            this.globalAxesGroup.add(makeLabel(axis.label, end, axis.color));
            this.globalAxesGroup.add(makeLabel(axis.negLabel, start, axis.color));
        });
        this.globeGroup.add(this.globalAxesGroup);
        // Initialize camera before using its properties
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        // Calculate camera x so globe occupies 80% of screen width
        const container = document.getElementById(containerId);
        const aspect = container.clientWidth / container.clientHeight;
        const fov = this.camera.fov;
        const targetScreenFraction = 0.6;
        const radius = 1;
        const cameraDistance = radius / (targetScreenFraction * Math.tan((fov / 2) * Math.PI / 180) * aspect);
        this.camera.position.set(cameraDistance, 0, 0);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById(canvasId),
            antialias: true,
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.resize();
        window.addEventListener('resize', () => this.resize());
        // OrbitControls for 360° rotation and zoom
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.enableRotate = true;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 0, 0);
        this.controls.minDistance = 1.2;
        this.controls.maxDistance = 5;
        this.scene.background = new THREE.Color(0x000011);
        // Add black sphere at center
        const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.65 
        });
        const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.globeGroup.add(sphereMesh);
        this.borderGroup = new THREE.Group();
        this.globeGroup.add(this.borderGroup);
        this.addDebugLines();
        this.animate();
    }

    resize() {
        const container = document.getElementById('globe-container');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    drawBorders(geojson) {
        this.borderGroup.clear();
        geojson.features.forEach(feature => {
            this.drawCountryBorders(feature, 0xcccccc);
        });
    }

    highlightCountry(code, geojson) {
        this.borderGroup.children.forEach(line => {
            line.material.color.set(0xcccccc);
        });
        geojson.features.forEach(feature => {
            const countryCode = feature.properties.code || feature.properties['ISO3166-1-Alpha-2'];
            if (countryCode === code) {
                this.drawCountryBorders(feature, 0xff0033);
            }
        });
    }

    addDebugLines() {
        // Equator (green, full circle)
        const equatorPoints = [];
        for (let lng = -180; lng <= 180; lng += 2) {
            const latRad = 0;
            const lngRad = -lng * Math.PI / 180;
            const radius = 1.02;
            const x = radius * Math.cos(latRad) * Math.cos(lngRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.sin(lngRad);
            equatorPoints.push(new THREE.Vector3(x, y, z));
        }
        equatorPoints.push(equatorPoints[0].clone());
        const equatorGeometry = new THREE.BufferGeometry().setFromPoints(equatorPoints);
        const equatorMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const equatorLine = new THREE.Line(equatorGeometry, equatorMaterial);
        this.globeGroup.add(equatorLine);

        // Prime Meridian (red, full circle)
        const meridianPoints = [];
        for (let lat = -180; lat <= 180; lat += 2) {
            const latRad = lat * Math.PI / 180;
            const lngRad = 0;
            const radius = 1.02;
            const x = radius * Math.cos(latRad) * Math.cos(lngRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.sin(lngRad);
            meridianPoints.push(new THREE.Vector3(x, y, z));
        }
        meridianPoints.push(meridianPoints[0].clone());
        const meridianGeometry = new THREE.BufferGeometry().setFromPoints(meridianPoints);
        const meridianMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const meridianLine = new THREE.Line(meridianGeometry, meridianMaterial);
        this.globeGroup.add(meridianLine);

        // X axis circle (blue, full circle around X/red axis)
        const xCirclePoints = [];
        for (let theta = 0; theta <= 360; theta += 2) {
            const rad = theta * Math.PI / 180;
            const radius = 1.02;
            const x = 0;
            const y = radius * Math.cos(rad);
            const z = radius * Math.sin(rad);
            xCirclePoints.push(new THREE.Vector3(x, y, z));
        }
        xCirclePoints.push(xCirclePoints[0].clone());
        const xCircleGeometry = new THREE.BufferGeometry().setFromPoints(xCirclePoints);
        const xCircleMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
        const xCircleLine = new THREE.Line(xCircleGeometry, xCircleMaterial);
        this.globeGroup.add(xCircleLine);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Minimal usage
const globe = new Globe();
window.globe = globe;
fetch('/static/data/world-countries.geojson')
  .then(res => res.json())
  .then(data => {
    globe.drawBorders(data);
    window.geojson = data;
    // To highlight a country, call globe.highlightCountry(code, window.geojson);
  });

