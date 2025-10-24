const COUNTRY_FILL_COLOR = 0x222222;
// Minimal Globe rendering with Three.js
class Globe {
    fillCountryArea(name, geojson, color = COUNTRY_FILL_COLOR) {
        // Create filledGroup if not present
        if (!this.filledGroup) {
            this.filledGroup = new THREE.Group();
            this.globeGroup.add(this.filledGroup);
        }
        // Remove previous meshes for this country name
        const toRemove = [];
        this.filledGroup.children.forEach(mesh => {
            if (mesh.userData && mesh.userData.name === name) {
                toRemove.push(mesh);
            }
        });
        toRemove.forEach(mesh => this.filledGroup.remove(mesh));

        // List of ISO codes for countries with area < 70 km²
        const smallCountryCodes = [
            'VA', // Vatican City
            'MC', // Monaco
            'NR', // Nauru
            'TV', // Tuvalu
            'SM', // San Marino
            'LI', // Liechtenstein
            'KN', // Saint Kitts and Nevis
            'MH', // Marshall Islands
            'MV', // Maldives
            'MT', // Malta
            'GD', // Grenada
            'VC', // Saint Vincent and the Grenadines
            'BB', // Barbados
            'AG', // Antigua and Barbuda
            'SC'  // Seychelles
        ];
        geojson.features.forEach(feature => {
            let countryName = feature.properties.name || feature.properties['NAME'];
            if (countryName === name) {
                let polygons = [];
                if (feature.geometry.type === 'Polygon') {
                    polygons = [feature.geometry.coordinates];
                } else if (feature.geometry.type === 'MultiPolygon') {
                    polygons = feature.geometry.coordinates;
                }
                polygons.forEach(polygon => {
                    // Each polygon may have holes (first ring is outer, rest are holes)
                    // Project lat/lon to 3D, then to 2D for triangulation, then back to 3D
                    // We'll use a simple equirectangular projection for triangulation
                    const rings2D = polygon.map(ring => ring.map(([lng, lat]) => new THREE.Vector2(lng, lat)));
                    if (!rings2D[0] || rings2D[0].length < 3) return;
                    // Show radiating dot for all small countries
                    if (smallCountryCodes.includes(name)) {
                        const minLng = Math.min(...rings2D[0].map(pt => pt.x));
                        const maxLng = Math.max(...rings2D[0].map(pt => pt.x));
                        const minLat = Math.min(...rings2D[0].map(pt => pt.y));
                        const maxLat = Math.max(...rings2D[0].map(pt => pt.y));
                        const lng = (minLng + maxLng) / 2;
                        const lat = (minLat + maxLat) / 2;
                        const latRad = lat * Math.PI / 180;
                        const lngRad = -lng * Math.PI / 180;
                        const radius = 1.012;
                        const x = Math.cos(latRad) * Math.cos(lngRad) * radius;
                        const y = Math.sin(latRad) * radius;
                        const z = Math.cos(latRad) * Math.sin(lngRad) * radius;
                        // Red core (smaller)
                        const markerGeometry = new THREE.SphereGeometry(0.004, 16, 16);
                        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff2222 });
                        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
                        marker.position.set(x, y, z);
                        marker.userData.name = name;
                        this.filledGroup.add(marker);
                        // Radiating glow using a sprite (smaller)
                        const canvas = document.createElement('canvas');
                        canvas.width = 64;
                        canvas.height = 64;
                        const ctx = canvas.getContext('2d');
                        const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 24);
                        gradient.addColorStop(0, 'rgba(255,32,32,0.7)');
                        gradient.addColorStop(0.5, 'rgba(255,32,32,0.2)');
                        gradient.addColorStop(1, 'rgba(255,32,32,0)');
                        ctx.fillStyle = gradient;
                        ctx.beginPath();
                        ctx.arc(32, 32, 32, 0, 2 * Math.PI);
                        ctx.fill();
                        const texture = new THREE.CanvasTexture(canvas);
                        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
                        const sprite = new THREE.Sprite(spriteMaterial);
                        sprite.position.set(x, y, z);
                        sprite.scale.set(0.03, 0.03, 1);
                        this.filledGroup.add(sprite);
                        // Animate pulsing
                        let pulseUp = true;
                        let scale = 0.03;
                        const animatePulse = () => {
                            if (!sprite.parent) return; // Stop if removed
                            if (pulseUp) {
                                scale += 0.0007;
                                if (scale > 0.045) pulseUp = false;
                            } else {
                                scale -= 0.0007;
                                if (scale < 0.025) pulseUp = true;
                            }
                            sprite.scale.set(scale, scale, 1);
                            requestAnimationFrame(animatePulse);
                        };
                        animatePulse();
                        return;
                    }
                    const shape = new THREE.Shape(rings2D[0]);
                    for (let i = 1; i < rings2D.length; i++) {
                        shape.holes.push(new THREE.Path(rings2D[i]));
                    }
                    const geometry2D = new THREE.ShapeGeometry(shape, 12);
                    // Project 2D geometry vertices back to sphere
                    const position = geometry2D.getAttribute('position');
                    for (let i = 0; i < position.count; i++) {
                        const lng = position.getX(i);
                        const lat = position.getY(i);
                        const latRad = lat * Math.PI / 180;
                        const lngRad = -lng * Math.PI / 180;
                        const radius = 1.008;
                        const x = Math.cos(latRad) * Math.cos(lngRad) * radius;
                        const y = Math.sin(latRad) * radius;
                        const z = Math.cos(latRad) * Math.sin(lngRad) * radius;
                        position.setXYZ(i, x, y, z);
                    }
                    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
                    const mesh = new THREE.Mesh(geometry2D, material);
                    mesh.userData.name = name;
                    this.filledGroup.add(mesh);
                });
            }
        });
    }
    fillCountry(name, geojson, color = COUNTRY_FILL_COLOR) {
        geojson.features.forEach(feature => {
            const countryName = feature.properties.name || feature.properties['NAME'];
            if (countryName === name) {
                const coords = feature.geometry.type === 'Polygon'
                    ? feature.geometry.coordinates
                    : feature.geometry.coordinates.flat();
                coords.forEach(ring => {
                    const points = ring.map(([lng, lat]) => {
                        const latRad = lat * Math.PI / 180;
                        const lngRad = -lng * Math.PI / 180;
                        const radius = 1.009;
                        return new THREE.Vector3(
                            Math.cos(latRad) * Math.cos(lngRad) * radius,
                            Math.sin(latRad) * radius,
                            Math.cos(latRad) * Math.sin(lngRad) * radius
                        );
                    });
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ color });
                    material.linewidth = 3;
                    this.borderGroup.add(new THREE.Line(geometry, material));
                });
            }
        });
    }
    disableAutoRotate() {
        // Placeholder for compatibility with game.js
    }
    enableAutoRotate() {
        // Placeholder for compatibility with game.js
    }
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
        // this.globalAxesGroup = new THREE.Group();
        // const axes = [
        //     { dir: new THREE.Vector3(1,0,0), color: 0xff0000, label: 'X+', negLabel: 'X-' }, // bright red
        //     { dir: new THREE.Vector3(0,1,0), color: 0x00ff00, label: 'Y+', negLabel: 'Y-' }, // bright green
        //     { dir: new THREE.Vector3(0,0,1), color: 0x0000ff, label: 'Z+', negLabel: 'Z-' } // bright blue
        // ];
        // axes.forEach(axis => {
        //     const start = axis.dir.clone().multiplyScalar(-5);
        //     const end = axis.dir.clone().multiplyScalar(5);
        //     const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
        //     const lineMat = new THREE.LineBasicMaterial({ color: axis.color });
        //     const line = new THREE.Line(lineGeo, lineMat);
        //     this.globalAxesGroup.add(line);
        //     // Add labels at both ends
        //     const makeLabel = (text, position, color) => {
        //         const canvas = document.createElement('canvas');
        //         canvas.width = 128;
        //         canvas.height = 32;
        //         const ctx = canvas.getContext('2d');
        //         ctx.font = 'bold 22px Arial';
        //         // Use pure RGB for label color
        //         let rgb = '#ffffff';
        //         if (color === 0xff0000) rgb = '#ff0000';
        //         if (color === 0x00ff00) rgb = '#00ff00';
        //         if (color === 0x0000ff) rgb = '#0000ff';
        //         ctx.fillStyle = rgb;
        //         ctx.shadowColor = '#000';
        //         ctx.shadowBlur = 6;
        //         ctx.fillText(text, 10, 24);
        //         const texture = new THREE.CanvasTexture(canvas);
        //         const spriteMat = new THREE.SpriteMaterial({ map: texture });
        //         const sprite = new THREE.Sprite(spriteMat);
        //         sprite.position.copy(position);
        //         sprite.scale.set(0.6, 0.18, 1);
        //         return sprite;
        //     };
        //     this.globalAxesGroup.add(makeLabel(axis.label, end, axis.color));
        //     this.globalAxesGroup.add(makeLabel(axis.negLabel, start, axis.color));
        // });
        // this.globeGroup.add(this.globalAxesGroup);
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
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 5;
    this.scene.background = new THREE.Color(0x100c08); // smoky black
        // Add black sphere at center
        const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.90 
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
            let countryId = feature.properties.name || feature.properties['ISO3166-1-Alpha-2'];
            if (countryId === '-99') {
                countryId = feature.properties.name || feature.properties['NAME'];
            }
            this.drawCountryBorders(feature, 0xcccccc);
        });
    }

    highlightCountry(name, geojson) {
        // Remove previous highlight lines for this country (red)
        const toRemove = [];
        this.borderGroup.children.forEach(line => {
            if (line.material.color.getHex() === 0xff0033) {
                toRemove.push(line);
            } else {
                line.material.color.set(0xcccccc);
            }
        });
        toRemove.forEach(line => this.borderGroup.remove(line));
        geojson.features.forEach(feature => {
            let countryName = feature.properties.name || feature.properties['NAME'];
            if (countryName === name) {
                this.drawCountryBorders(feature, 0xff0033);
            }
        });
        // --- three-globe inspired centering logic ---
        // Find centroid
        const feature = geojson.features.find(f => {
            let countryName = f.properties.name || f.properties['NAME'];
            return countryName === name;
        });
        if (!feature) return;
        let points = [];
        if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates.forEach(ring => points.push(...ring));
        } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach(poly => poly.forEach(ring => points.push(...ring)));
        }
        if (!points.length) return;
        // Normalize longitudes for antimeridian-crossing countries
        let lngs = points.map(([lng, _]) => lng);
        // If the longitude range is > 180, shift all to same side
        let minLng = Math.min(...lngs);
        let maxLng = Math.max(...lngs);
        let shift = 0;
        if (maxLng - minLng > 180) {
            // Shift all longitudes: if < 0, add 360
            points = points.map(([lng, lat]) => [lng < 0 ? lng + 360 : lng, lat]);
        }
        let sumLat = 0, sumLng = 0;
        points.forEach(([lng, lat]) => { sumLat += lat; sumLng += lng; });
        let centroidLat = sumLat / points.length;
        let centroidLng = sumLng / points.length;
        // If we shifted, bring centroidLng back to [-180,180]
        if (maxLng - minLng > 180 && centroidLng > 180) centroidLng -= 360;
        // Convert to 3D position on sphere
        const latRad = centroidLat * Math.PI / 180;
        const lngRad = -centroidLng * Math.PI / 180;
        const radius = 1.01;
        const target = new THREE.Vector3(
            Math.cos(latRad) * Math.cos(lngRad) * radius,
            Math.sin(latRad) * radius,
            Math.cos(latRad) * Math.sin(lngRad) * radius
        );
        // Animate OrbitControls target and camera position
        const startTarget = this.controls.target.clone();
        const startPos = this.camera.position.clone();
        // Camera distance stays the same
        const camDist = startPos.length();
        let t = 0;
        const duration = 0.8;
        const animate = () => {
            t += 0.04;
            const ease = 1 - Math.pow(1-t/duration, 2); // ease-out
            // Interpolate target
            this.controls.target.lerpVectors(startTarget, target, Math.min(ease, 1));
            // Camera position: always look from same distance
            const phi = Math.PI/2 - latRad; // polar angle
            const theta = lngRad; // azimuthal angle
            const camPhi = Math.max(0.15, Math.min(Math.PI-0.15, phi));
            const camTheta = theta;
            const camX = camDist * Math.sin(camPhi) * Math.cos(camTheta);
            const camY = camDist * Math.cos(camPhi);
            const camZ = camDist * Math.sin(camPhi) * Math.sin(camTheta);
            this.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), Math.min(ease, 1));
            this.controls.update();
            if (t < duration) {
                requestAnimationFrame(animate);
            } else {
                // After centering, set controls.target to (0,0,0) but keep current camera position and globe rotation
                this.controls.target.set(0, 0, 0);
                // Camera position stays as is
                // Globe rotation stays as is
                this.controls.update();
            }
        };
        animate();
    }

    fillCountry(name, geojson, color = 0x90ff90) {
        // Remove previous fill lines for this country (green)
        const toRemove = [];
        this.borderGroup.children.forEach(line => {
            if (line.material.color.getHex() === color) {
                toRemove.push(line);
            }
        });
        toRemove.forEach(line => this.borderGroup.remove(line));
        geojson.features.forEach(feature => {
            let countryId = feature.properties.name || feature.properties['ISO3166-1-Alpha-2'];
            if (countryId === '-99') {
                countryId = feature.properties.name || feature.properties['NAME'];
            }
            if (countryId === name) {
                const coords = feature.geometry.type === 'Polygon'
                    ? feature.geometry.coordinates
                    : feature.geometry.coordinates.flat();
                coords.forEach(ring => {
                    const points = ring.map(([lng, lat]) => {
                        const latRad = lat * Math.PI / 180;
                        const lngRad = -lng * Math.PI / 180;
                        const radius = 1.009;
                        return new THREE.Vector3(
                            Math.cos(latRad) * Math.cos(lngRad) * radius,
                            Math.sin(latRad) * radius,
                            Math.cos(latRad) * Math.sin(lngRad) * radius
                        );
                    });
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ color });
                    material.linewidth = 3;
                    this.borderGroup.add(new THREE.Line(geometry, material));
                });
            }
        });
    }

    addDebugLines() {
        // Equator (Y axis, green, full circle)
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
    const equatorMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // green
        const equatorLine = new THREE.Line(equatorGeometry, equatorMaterial);
        this.globeGroup.add(equatorLine);

        // Prime Meridian (X axis, red, full circle)
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
    const meridianMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // red
        const meridianLine = new THREE.Line(meridianGeometry, meridianMaterial);
        this.globeGroup.add(meridianLine);

        // X axis circle (Z axis, blue, full circle around X/red axis)
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
    const xCircleMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff }); // blue
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
    // To highlight a country, call globe.highlightCountry(name, window.geojson);
  });

