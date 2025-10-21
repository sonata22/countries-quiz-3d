// Minimal Globe rendering with Three.js
class Globe {
    constructor(containerId = 'globe-container', canvasId = 'globe-canvas') {
        this.scene = new THREE.Scene();
        // Camera positioned along positive Z axis, looking at origin
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.camera.position.set(0, 0, 3); // (x=0, y=0, z=3)
        this.camera.lookAt(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById(canvasId),
            antialias: true,
            alpha: true
        });
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = false;
        this.controls.enableRotate = true;
        this.controls.target.set(0, 0, 0); // Center controls on intersection
        this.scene.background = new THREE.Color(0x000011);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.earth = this.createEarth();
        this.scene.add(this.earth);
        this.borderGroup = new THREE.Group();
        this.scene.add(this.borderGroup);
        this.addDebugLines();
        this.animate();
    }

    resize() {
        const container = document.getElementById('globe-container');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    createEarth() {
        const geometry = new THREE.SphereGeometry(1, 128, 64);
        const textureLoader = new THREE.TextureLoader();
        // Use local high-res image
        const earthTexture = textureLoader.load(
            '/static/images/globe.png',
            undefined,
            undefined,
            function (err) { console.error('Texture load error:', err); }
        );
        return new THREE.Mesh(
            geometry,
            new THREE.MeshPhongMaterial({
                map: earthTexture,
                color: 0xffffff,
                shininess: 30
            })
        );
    }

    drawBorders(geojson) {
        this.borderGroup.clear();
        geojson.features.forEach(feature => {
            const coords = feature.geometry.type === 'Polygon'
                ? feature.geometry.coordinates
                : feature.geometry.coordinates.flat();
            coords.forEach(ring => {
                const points = ring.map(([lng, lat]) => {
                    const latRad = lat * Math.PI / 180;
                    const lngRad = -lng * Math.PI / 180;
                    const radius = 1.01;
                    return new THREE.Vector3(
                        -Math.cos(latRad) * Math.cos(lngRad) * radius, // flipped x
                        Math.sin(latRad) * radius,
                        Math.cos(latRad) * Math.sin(lngRad) * radius
                    );
                });
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: 0xcccccc });
                this.borderGroup.add(new THREE.Line(geometry, material));
            });
        });
    }

    highlightCountry(code, geojson) {
        this.borderGroup.children.forEach(line => {
            line.material.color.set(0xcccccc);
        });
        geojson.features.forEach(feature => {
            const countryCode = feature.properties.code || feature.properties['ISO3166-1-Alpha-2'];
            if (countryCode === code) {
                const coords = feature.geometry.type === 'Polygon'
                    ? feature.geometry.coordinates
                    : feature.geometry.coordinates.flat();
                coords.forEach(ring => {
                    const points = ring.map(([lng, lat]) => {
                        const latRad = lat * Math.PI / 180;
                        const lngRad = -lng * Math.PI / 180;
                        const radius = 1.01;
                        return new THREE.Vector3(
                            -Math.cos(latRad) * Math.cos(lngRad) * radius, // flipped x
                            Math.sin(latRad) * radius,
                            Math.cos(latRad) * Math.sin(lngRad) * radius
                        );
                    });
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ color: 0xff0033 });
                    this.borderGroup.add(new THREE.Line(geometry, material));
                });
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
        this.scene.add(equatorLine);

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
        this.scene.add(meridianLine);
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