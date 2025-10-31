// Minimal Globe rendering with Three.js
const COUNTRY_FILL_COLOR = 0x222222;
class Globe {
    // Remove all country highlights and overlays
    removeHighlight() {
        // Remove all red highlight lines from borderGroup
        if (this.borderGroup && this.borderGroup.children) {
            const toRemove = [];
            this.borderGroup.children.forEach(line => {
                if (line.material && line.material.color.getHex() === 0xff0033) {
                    toRemove.push(line);
                }
            });
            toRemove.forEach(line => this.borderGroup.remove(line));
        }
        // Optionally clear all filled overlays
        if (this.filledGroup && this._countryOverlayMeshes) {
            Object.values(this._countryOverlayMeshes).forEach(mesh => {
                this.filledGroup.remove(mesh);
                if (mesh.material) mesh.material.dispose();
                if (mesh.geometry) mesh.geometry.dispose();
            });
            this._countryOverlayMeshes = {};
        }
    }
    // Best-practice: robust, hole-free 3D country fill
    fillCountryArea(name, geojson, color = COUNTRY_FILL_COLOR) {
        // Remove previous fill overlays for this country
        if (!this.filledGroup) {
            this.filledGroup = new THREE.Group();
            this.globeGroup.add(this.filledGroup);
        }
        if (!this._countryOverlayMeshes) this._countryOverlayMeshes = {};
        if (this._countryOverlayMeshes[name]) {
            this.filledGroup.remove(this._countryOverlayMeshes[name]);
            this._countryOverlayMeshes[name].material.dispose();
            this._countryOverlayMeshes[name].geometry.dispose();
        }
        // Find the feature
        geojson.features.forEach(feature => {
            let countryName = feature.properties.name || feature.properties['NAME'];
            if (countryName !== name) return;
            let polygons = [];
            if (feature.geometry.type === 'Polygon') {
                polygons = [feature.geometry.coordinates];
            } else if (feature.geometry.type === 'MultiPolygon') {
                polygons = feature.geometry.coordinates;
            }
            // Rasterize to canvas
            const canvasSize = 1024;
            const canvas = document.createElement('canvas');
            canvas.width = canvasSize;
            canvas.height = canvasSize;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvasSize, canvasSize);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            polygons.forEach(polygon => {
                polygon.forEach((ring, i) => {
                    ring.forEach(([lng, lat], j) => {
                        // Equirectangular projection
                        const x = ((lng + 180) / 360) * canvasSize;
                        const y = ((90 - lat) / 180) * canvasSize;
                        if (j === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    });
                    ctx.closePath();
                });
            });
            ctx.fill();
            // Create texture
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            // Create overlay sphere mesh
            const overlayGeometry = new THREE.SphereGeometry(1.011, 64, 64);
            const overlayMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: 0.9,
                color: color,
                alphaTest: 0.01
            });
            const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
            overlayMesh.userData.name = name;
            this.filledGroup.add(overlayMesh);
            this._countryOverlayMeshes[name] = overlayMesh;
        });
    }
// Minimal Globe rendering with Three.js
// (COUNTRY_FILL_COLOR and class Globe are already defined above)
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
    drawCountryBorders(feature, color = 0xFDFFF5) {
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
    this.scene.background = new THREE.Color(0x000000);
        // Add black sphere at center
        const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x100c08, 
            transparent: true, 
            opacity: 0.95
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
            this.drawCountryBorders(feature, 0xFDFFF5);
        });
    }

    highlightCountry(name, geojson) {
        // Remove previous highlight lines for this country (red)
        const toRemove = [];
        this.borderGroup.children.forEach(line => {
            if (line.material.color.getHex() === 0xff0033) {
                toRemove.push(line);
            } else {
                line.material.color.set(0xFDFFF5);
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

