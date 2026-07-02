import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// constants so its easier to tweak later
const CLEAR_COLOUR = 0x0f1118;
const CAM_FOV = 60;
const CAM_NEAR = 0.1;
const CAM_FAR = 2000;
const CAM_START_POS = { x: 0, y: 1.2, z: 5 };
const MODEL_PATH = "./Assets/3DExport.glb";

const canvas = document.querySelector("#bg");
const statusLabel = document.querySelector("#status");

// scene
const scene = new THREE.Scene();

// camera
const camera = new THREE.PerspectiveCamera(
    CAM_FOV,
    window.innerWidth / window.innerHeight,
    CAM_NEAR,
    CAM_FAR
);
camera.position.set(CAM_START_POS.x, CAM_START_POS.y, CAM_START_POS.z);

// renderer
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(CLEAR_COLOUR);

// controls for quick testing / inspection
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

// lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x2a2f45, 0.95);
hemiLight.position.set(0, 30, 0);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
keyLight.position.set(6, 8, 7);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xbfd2ff, 0.55);
fillLight.position.set(-5, 2, -3);
scene.add(fillLight);

const loader = new GLTFLoader();

loader.load(
    MODEL_PATH,
    (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        // auto frame the model in camera so it "just works"
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z);

        // keep controls centered on the model
        controls.target.copy(center);

        const fitDistance = maxSize > 0 ? maxSize * 1.5 : 5;
        camera.position.set(center.x, center.y + maxSize * 0.35, center.z + fitDistance);
        camera.near = Math.max(maxSize / 100, 0.01);
        camera.far = Math.max(maxSize * 100, 2000);
        camera.updateProjectionMatrix();

        statusLabel.textContent = `Model loaded: ${MODEL_PATH}`;
    },
    undefined,
    (error) => {
        console.error("Failed to load GLB:", error);
        statusLabel.textContent = "Failed to load model - check path or run with a local server.";
    }
);

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();
