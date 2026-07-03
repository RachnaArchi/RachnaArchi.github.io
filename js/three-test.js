import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { gsap } from "gsap";
import { Observer } from "gsap/all";

gsap.registerPlugin(Observer);

// constants so its easier to tweak later
const CLEAR_COLOUR = 0x0f1118;
const CAM_FOV = 60;
const CAM_NEAR = 0.1;
const CAM_FAR = 2000;
// lower factor = camera closer to model
const CAM_DISTANCE_FACTOR = 0.20;
const CAM_LEFT_FACTOR = 0.0; // adjust cam rotation on x axis
const CAM_HEIGHT_FACTOR = 0.0; // adjust cam rotation on y axis
const SCROLL_DURATION = 1;
const SCROLL_TOLERANCE = 30;
const DEBUG = false;

// loading screen
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SCRAMBLE_NAME = "Rachna Leang";
const SCRAMBLE_INTERVAL = 40;
const LETTER_SCRAMBLE_DURATION = 120;
const POST_LOAD_DELAY = 2000;

const loaderOverlay = document.querySelector("#loader");
const loaderName = document.querySelector("#loader-name");
const loaderBarFill = document.querySelector("#loader-bar-fill");
const letterResolved = new Array(SCRAMBLE_NAME.length).fill(false);
let modelLoaded = false;
let nameRevealComplete = false;
let hideScheduled = false;

function randomChar() {
    return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function renderScrambleName() {
    let output = "";

    for (let i = 0; i < SCRAMBLE_NAME.length; i++) {
        const char = SCRAMBLE_NAME[i];
        if (char === " " || letterResolved[i]) {
            output += char;
        } else {
            output += randomChar();
        }
    }

    loaderName.textContent = output;
}

function scrambleLetter(index) {
    return new Promise((resolve) => {
        if (SCRAMBLE_NAME[index] === " ") {
            letterResolved[index] = true;
            renderScrambleName();
            resolve();
            return;
        }

        const start = performance.now();
        const tick = setInterval(() => {
            renderScrambleName();

            if (performance.now() - start >= LETTER_SCRAMBLE_DURATION) {
                clearInterval(tick);
                letterResolved[index] = true;
                renderScrambleName();
                resolve();
            }
        }, SCRAMBLE_INTERVAL);
    });
}

async function runNameReveal() {
    for (let i = 0; i < SCRAMBLE_NAME.length; i++) {
        await scrambleLetter(i);
    }

    loaderName.textContent = SCRAMBLE_NAME;
    nameRevealComplete = true;
    tryHideLoader();
}

function updateLoaderProgress(pct) {
    loaderBarFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

function tryHideLoader() {
    if (!modelLoaded || !nameRevealComplete || hideScheduled) return;

    hideScheduled = true;
    setTimeout(() => {
        updateLoaderProgress(100);
        gsap.to(loaderOverlay, {
            opacity: 0,
            duration: 0.6,
            onComplete: () => {
                loaderOverlay.style.display = "none";
            }
        });
    }, POST_LOAD_DELAY);
}

function onModelLoaded() {
    modelLoaded = true;
    updateLoaderProgress(100);
    tryHideLoader();
}

runNameReveal();

// resolved from the HTML page URL, not this JS file location
const MODEL_PATH = "./Assets/3DExport.glb";

// fixed model positions - scroll down moves right, scroll up moves left
const MODEL_SECTIONS = [
    { pos: { x: 100, y: 0, z: 0 }, label: "Home" },
    { pos: { x: 50, y: 0, z: 0 }, label: "Section 2" },
    { pos: { x: 0, y: 0, z: 0 }, label: "Section 3" },
    { pos: { x: -50, y: 0, z: 0 }, label: "Section 4" },
    { pos: { x: -100, y: 0, z: 0 }, label: "Section 5" },
];

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

camera.position.set(-3000, 100, 0);

// renderer
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(CLEAR_COLOUR);

let controls = undefined;
if (DEBUG) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
}

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

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

const lookTarget = new THREE.Vector3();
let modelGroup = null;
let modelLookHeight = 0;
let cameraZ = 5;
let camLeftOffset = 300
let camHeightOffset = 1;
let currentIndex = 0;
let isAnimating = false;

function updateStatus() {
    const section = MODEL_SECTIONS[currentIndex];
    statusLabel.textContent = `${section.label} (${currentIndex + 1}/${MODEL_SECTIONS.length})`;
}

function setCameraLeftOfModel() {
    const section = MODEL_SECTIONS[currentIndex];
    camera.position.set(
        section.pos.x - camLeftOffset,
        section.pos.y + camHeightOffset,
        cameraZ
    );
}

function goToNextSection() {
    if (!modelGroup || isAnimating || currentIndex >= MODEL_SECTIONS.length - 1) return;

    isAnimating = true;
    currentIndex++;

    const target = MODEL_SECTIONS[currentIndex];
    gsap.to(modelGroup.position, {
        x: target.pos.x,
        y: target.pos.y,
        z: target.pos.z,
        duration: SCROLL_DURATION,
        ease: "power2.inOut",
        onComplete: () => {
            isAnimating = false;
            updateStatus();
        }
    });
}

function goToPrevSection() {
    if (!modelGroup || isAnimating || currentIndex <= 0) return;

    isAnimating = true;
    currentIndex--;

    const target = MODEL_SECTIONS[currentIndex];
    gsap.to(modelGroup.position, {
        x: target.pos.x,
        y: target.pos.y,
        z: target.pos.z,
        duration: SCROLL_DURATION,
        ease: "power2.inOut",
        onComplete: () => {
            isAnimating = false;
            updateStatus();
        }
    });
}

function setupScrollControl() {
    Observer.create({
        target: window,
        type: "wheel,touch",
        preventDefault: true,
        onDown: () => goToNextSection(),
        onUp: () => goToPrevSection(),
        tolerance: SCROLL_TOLERANCE
    });
}

loader.load(
    MODEL_PATH,
    (gltf) => {
        modelGroup = new THREE.Group();

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z);

        gltf.scene.position.sub(center);
        modelGroup.add(gltf.scene);

        const start = MODEL_SECTIONS[0];
        modelGroup.position.set(start.pos.x, start.pos.y, start.pos.z);
        scene.add(modelGroup);

        modelLookHeight = size.y * 0.35;
        camLeftOffset = maxSize * CAM_LEFT_FACTOR;
        camHeightOffset = maxSize * CAM_HEIGHT_FACTOR;
        cameraZ = maxSize * CAM_DISTANCE_FACTOR;
        camera.near = Math.max(maxSize / 100, 0.01);
        camera.far = Math.max(maxSize * 100, 2000);
        camera.updateProjectionMatrix();

        setCameraLeftOfModel();
        updateStatus();
        setupScrollControl();
        onModelLoaded();
    },
    (xhr) => {
        if (xhr.lengthComputable) {
            const pct = (xhr.loaded / xhr.total) * 100;
            updateLoaderProgress(pct);
        }
    },
    (error) => {
        console.error("Failed to load GLB:", error);
        statusLabel.textContent = "Failed to load model - check path or run with a local server.";
        modelLoaded = true;
        nameRevealComplete = true;
        tryHideLoader();
    }
);

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);

    if (modelGroup) {
        lookTarget.copy(modelGroup.position);
        lookTarget.y += modelLookHeight;
        // camera.lookAt(lookTarget);
    }

    if (DEBUG) {
        controls.update();
    }

    renderer.render(scene, camera);
}

animate();
