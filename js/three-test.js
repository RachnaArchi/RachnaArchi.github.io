import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"; // used for loading compressed glb files
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { gsap } from "gsap";
import { Observer } from "gsap/all";
import { Text } from "troika-three-text";

gsap.registerPlugin(Observer);

// constants so its easier to tweak later
const CLEAR_COLOUR = 0x0f1118;
const CAM_FOV = 60;
const CAM_NEAR = 0.1;
const CAM_FAR = 2000;

// DEBUG = console logs for camera/model positions
const DEBUG = true;
// ENABLE_ORBIT_CONTROLS = manual camera movement (independent of DEBUG)
const ENABLE_ORBIT_CONTROLS = false;
// lower factor = camera closer to model
const CAM_DISTANCE_FACTOR = 0.06;
const CAM_LEFT_FACTOR = 0.0; // adjust cam rotation on x axis
const CAM_HEIGHT_FACTOR = 0.05; // adjust cam rotation on y axis
const SCROLL_DURATION = 1;
const SCROLL_TOLERANCE = 30;
const TEXT_FONT_SIZE = 2;
const TEXT_MAX_WIDTH = 40;
const TEXT_REVEAL_DURATION = 1;
const TEXT_HIDE_DURATION = 1;
const MOBILE_BREAKPOINT = 1080;

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
let loaderHidden = false;
let initialTextPlayed = false;

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
                loaderHidden = true;
                playInitialSectionText();
            }
        });
    }, POST_LOAD_DELAY);
}

function playInitialSectionText() {
    if (!loaderHidden || initialTextPlayed || sectionTexts.length === 0) return;

    initialTextPlayed = true;
    revealSectionText(currentIndex);
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
    { mobilePos: { x: 100, y: 0, z: 0 }, desktopPos: { x: 200, y: 0, z: 0 }, label: "Home" },
    { mobilePos: { x: 50, y: 0, z: 0 }, desktopPos: { x: 50, y: 0, z: 0 }, label: "Socials" },
    { mobilePos: { x: 0, y: 0, z: 0 }, desktopPos: { x: 0, y: 0, z: 0 }, label: "Work One" },
    { mobilePos: { x: -50, y: 0, z: 0 }, desktopPos: { x: -50, y: 0, z: 0 }, label: "Work Two" },
    { mobilePos: { x: -100, y: 0, z: 0 }, desktopPos: { x: -100, y: 0, z: 0 }, label: "Work Three" },
];

// tweak mobilePos / desktopPos independently per section
const TEXT_SECTIONS = [
    {
        mobilePos: { x: 100, y: 20, z: -100 },
        desktopPos: { x: 100, y: 20, z: -100 },
        text: "Bachelor of Architectural Design @ Griffith University. Cadet @ Metricon. Here to make Queensland cities vibrant and thriving."
    },
    {
        mobilePos: { x: 60, y: 0, z: -100 },
        desktopPos: { x: 60, y: 0, z: -100 },
        text: "Connect with me on Linkedin here."
    },
    {
        mobilePos: { x: 60, y: 0, z: -100 },
        desktopPos: { x: 60, y: 0, z: -100 },
        text: "This bridge is from one of my design courses!"
    },
    {
        mobilePos: { x: 60, y: 0, z: -100 },
        desktopPos: { x: 60, y: 0, z: -100 },
        text: "More to come soon!"
    },
    {
        mobilePos: { x: 60, y: 0, z: -100 },
        desktopPos: { x: 60, y: 0, z: -100 },
        text: "More to come soon!"
    },
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


// renderer
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(CLEAR_COLOUR);

let controls = undefined;
if (ENABLE_ORBIT_CONTROLS) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.addEventListener("change", () => logCameraPosition("Camera (OrbitControls)"));
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
let sectionTexts = [];
let isMobile = isMobileView();

function isMobileView() {
    return window.innerWidth < MOBILE_BREAKPOINT;
}

function getModelPos(section) {
    return isMobileView() ? section.mobilePos : section.desktopPos;
}

function getTextPos(section) {
    return isMobileView() ? section.mobilePos : section.desktopPos;
}

function debugLog(...args) {
    if (DEBUG) console.log(...args);
}

function logCameraPosition(context = "Camera") {
    if (!DEBUG) return;

    const { x, y, z } = camera.position;
    debugLog(`${context} position:`, { x, y, z });
}

function logModelPosition(context = "Model") {
    if (!DEBUG || !modelGroup) return;

    const { x, y, z } = modelGroup.position;
    debugLog(`${context} position:`, { x, y, z });
}

function updateStatus() {
    const section = MODEL_SECTIONS[currentIndex];
    statusLabel.textContent = `${section.label} (${currentIndex + 1}/${MODEL_SECTIONS.length})`;
}

function setTextByLength(textMesh, length) {
    const full = textMesh.userData.fullText;
    textMesh.text = full.slice(0, Math.max(0, Math.min(length, full.length)));
    textMesh.sync();
}

function stopTextAnimation(textMesh) {
    if (textMesh.userData.textTween) {
        textMesh.userData.textTween.kill();
        textMesh.userData.textTween = null;
    }
}

function revealSectionText(index) {
    const textMesh = sectionTexts[index];
    if (!textMesh) return Promise.resolve();

    stopTextAnimation(textMesh);

    const full = textMesh.userData.fullText;
    textMesh.visible = true;
    setTextByLength(textMesh, 0);

    const state = { length: 0 };

    return new Promise((resolve) => {
        textMesh.userData.textTween = gsap.to(state, {
            length: full.length,
            duration: TEXT_REVEAL_DURATION,
            ease: "none",
            onUpdate: () => setTextByLength(textMesh, Math.floor(state.length)),
            onComplete: () => {
                setTextByLength(textMesh, full.length);
                textMesh.userData.textTween = null;
                resolve();
            }
        });
    });
}

function hideSectionText(index) {
    const textMesh = sectionTexts[index];
    if (!textMesh) return Promise.resolve();

    stopTextAnimation(textMesh);

    const full = textMesh.userData.fullText;
    const state = { length: full.length };
    setTextByLength(textMesh, full.length);

    return new Promise((resolve) => {
        textMesh.userData.textTween = gsap.to(state, {
            length: 0,
            duration: TEXT_HIDE_DURATION,
            ease: "none",
            onUpdate: () => setTextByLength(textMesh, Math.ceil(state.length)),
            onComplete: () => {
                setTextByLength(textMesh, 0);
                textMesh.visible = false;
                textMesh.userData.textTween = null;
                resolve();
            }
        });
    });
}

function createSectionText(section) {
    const outText = new Text();
    const pos = getTextPos(section);

    outText.userData.fullText = section.text;
    outText.text = "";
    outText.fontSize = TEXT_FONT_SIZE;
    outText.color = 0xffffff;
    outText.maxWidth = TEXT_MAX_WIDTH;
    outText.position.set(pos.x, pos.y, pos.z);
    outText.textAlign = "left";
    outText.anchorX = "left";
    outText.anchorY = "middle";
    outText.visible = false;
    outText.sync();

    scene.add(outText);
    return outText;
}

function initSectionTexts() {
    sectionTexts = TEXT_SECTIONS.map((section) => createSectionText(section));
}

function applyViewportLayout() {
    if (!modelGroup) return;

    const mobile = isMobileView();
    if (mobile === isMobile) return;
    isMobile = mobile;

    const modelPos = getModelPos(MODEL_SECTIONS[currentIndex]);
    modelGroup.position.set(modelPos.x, modelPos.y, modelPos.z);
    setCameraLeftOfModel();

    sectionTexts.forEach((textMesh, i) => {
        const pos = getTextPos(TEXT_SECTIONS[i]);
        textMesh.position.set(pos.x, pos.y, pos.z);
        textMesh.sync();
    });
}

function warmupSectionTexts() {
    return Promise.all(
        sectionTexts.map(
            (textMesh) =>
                new Promise((resolve) => {
                    textMesh.text = textMesh.userData.fullText;
                    textMesh.sync(() => {
                        textMesh.text = "";
                        textMesh.visible = false;
                        textMesh.sync(resolve);
                    });
                })
        )
    );
}

async function transitionToSection(newIndex) {
    if (!modelGroup || isAnimating || newIndex === currentIndex) return;
    if (newIndex < 0 || newIndex >= MODEL_SECTIONS.length) return;

    isAnimating = true;
    const oldIndex = currentIndex;

    await hideSectionText(oldIndex);

    currentIndex = newIndex;
    updateStatus();

    const target = MODEL_SECTIONS[currentIndex];
    const targetPos = getModelPos(target);
    await new Promise((resolve) => {
        gsap.to(modelGroup.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: SCROLL_DURATION,
            ease: "power2.inOut",
            onComplete: resolve
        });
    });

    await revealSectionText(currentIndex);

    isAnimating = false;
}

function goToNextSection() {
    if (!modelGroup || isAnimating || currentIndex >= MODEL_SECTIONS.length - 1) return;
    transitionToSection(currentIndex + 1);
}

function goToPrevSection() {
    if (!modelGroup || isAnimating || currentIndex <= 0) return;
    transitionToSection(currentIndex - 1);
}

function setCameraLeftOfModel() {
    const section = MODEL_SECTIONS[currentIndex];
    const pos = getModelPos(section);
    camera.position.set(
        pos.x - camLeftOffset,
        pos.y + camHeightOffset,
        cameraZ
    );
    logCameraPosition("Camera (setCameraLeftOfModel)");
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

        //gltf.scene.position.sub(center);
        modelGroup.add(gltf.scene);

        const start = MODEL_SECTIONS[0];
        const startPos = getModelPos(start);
        modelGroup.position.set(startPos.x, startPos.y, startPos.z);
        scene.add(modelGroup);

        modelLookHeight = size.y * 0.35;
        camLeftOffset = maxSize * CAM_LEFT_FACTOR;
        camHeightOffset = maxSize * CAM_HEIGHT_FACTOR;
        cameraZ = maxSize * CAM_DISTANCE_FACTOR;
        camera.near = Math.max(maxSize / 100, 0.01);
        camera.far = Math.max(maxSize * 100, 2000);
        camera.updateProjectionMatrix();

        setCameraLeftOfModel();
        initSectionTexts();
        warmupSectionTexts().then(() => {
            logModelPosition("Model (loaded)");
            updateStatus();
            setupScrollControl();
            onModelLoaded();
        });
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
    applyViewportLayout();
});

function animate() {
    requestAnimationFrame(animate);

    if (modelGroup) {
        lookTarget.copy(modelGroup.position);
        lookTarget.y += modelLookHeight;
        // camera.lookAt(lookTarget);
    }

    if (ENABLE_ORBIT_CONTROLS && controls) {
        controls.update();
    }

    renderer.render(scene, camera);
}

animate();
