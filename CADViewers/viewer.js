// viewer.js

function initializeViewer(modelUrl) {
    // ─── Scene Setup ─────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(100, 100, 100);  // (x, y, z)
    camera.lookAt(0, 0, 50);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.screenSpacePanning = false;

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x202020);
    document.body.appendChild(renderer.domElement);

    // ─── Lighting ────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const radius = 10;
    const height = 5;

    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(x, height, z);
        dirLight.lookAt(0, 0, 0);
        scene.add(dirLight);
    }

    // ─── DRACO Loader Setup ───────────────────────────────────────
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    // ─── GLTF Loader with DRACO support ──────────────────────────
    const loader = new THREE.GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
        modelUrl,
        (gltf) => {
            scene.add(gltf.scene);
            document.getElementById('loading-screen').style.display = 'none'; // Hide loader
        },
        (xhr) => {
            const percent = (xhr.loaded / xhr.total) * 100;
            console.log(`Loading: ${percent.toFixed(2)}%`);
        },
        (error) => {
            console.error('Model load failed:', error);
            document.getElementById('loading-screen').textContent = 'Failed to load model.';
        }
    );

    // ─── Camera and Animation ────────────────────────────────────
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
