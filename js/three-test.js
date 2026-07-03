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
const STAR_COUNT = 200;
const STAR_DRIFT_DISTANCE = 200;
const TEXT_FONT_SIZE = 2;
const TEXT_MAX_WIDTH = 40;
const TEXT_FONT = "./Assets/fonts/Bitcount_Single/static/BitcountSingle_Roman-Regular.ttf";
const TITLE_FONT = "./Assets/fonts/Bitcount_Single/static/BitcountSingle_Roman-Bold.ttf";
const TITLE_TEXT = "Rachna Leang";
const TITLE_TEXT_POS = { x: 159.2, y: 33, z: -10 };
const TITLE_FONT_SIZE = 2;
const SCROLL_HINT_TEXT = "scroll down for more!";
const SCROLL_HINT_TEXT_POS = { x: 270, y: 65, z: -40 };
const SCROLL_HINT_FONT_SIZE = 2;
const LINKEDIN_URL = "https://www.linkedin.com/in/rachna-leang-b702952b9/";
const LINKEDIN_TEXTURE_PATH = "./Assets/images/linkedin.png";
const LINKEDIN_CUBE_POS = {
    mobilePos: { x: 60, y: 0, z: -100 },
    desktopPos: { x: 200, y: 30, z: -1 }
};
const LINKEDIN_CUBE_SIZE = 3;
const LINKEDIN_CUBE_SCALE_MIN = 1.0;
const LINKEDIN_CUBE_SCALE_MAX = 1.5;
const LINKEDIN_CUBE_SCALE_STEP = 0.003;
const LINKEDIN_CUBE_SPIN_X = 0.01;
const LINKEDIN_CUBE_SPIN_Y = 0.005;
const LINKEDIN_CUBE_SPIN_Z = 0.0001;
const LINKEDIN_CUBE_SECTION_INDEX = 1;
const LINKEDIN_CUBE_ANIM_DURATION = 1;
const LINKEDIN_CUBE_EXIT_ANIM_DURATION = 1;
const LINKEDIN_CUBE_SLIDE_OFFSET = 50;
const TEXT_REVEAL_DURATION = 1;
const TEXT_HIDE_DURATION = 1;
const HOME_TEXT_HIDE_DURATION = TEXT_HIDE_DURATION / 2;
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
    revealTitleText();
    revealScrollHintText();
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
    { mobilePos: { x: 50, y: 0, z: 0 }, desktopPos: { x: 0, y: 0, z: 0 }, label: "Socials" },
    { mobilePos: { x: 0, y: 0, z: 0 }, desktopPos: { x: -200, y: 0, z: 0 }, label: "Work One" },
    { mobilePos: { x: -50, y: 0, z: 0 }, desktopPos: { x: -400, y: 0, z: 0 }, label: "Work Two" },
    { mobilePos: { x: -100, y: 0, z: 0 }, desktopPos: { x: -600, y: 0, z: 0 }, label: "Work Three" },
];

// tweak mobilePos / desktopPos independently per section
const TEXT_SECTIONS = [
    {
        mobilePos: { x: 100, y: 20, z: -100 },
        desktopPos: { x: 150, y: 25, z: -20 },
        text: "Bachelor of Architectural Design @ Griffith University. \nCadet @ Metricon. \nHere to make Queensland cities vibrant and thriving."
    },
    {
        mobilePos: { x: 60, y: 0, z: -100 },
        desktopPos: { x: 150, y: 50, z: -20 },
        text: "Connect with me on Linkedin here."
    },
    {
        mobilePos: { x: 60, y: 0, z: -100 },
        desktopPos: { x: 150, y: 20, z: -20 },
        text: "This bridge is from one of my design courses!"
    },
    {
        mobilePos: { x: 60, y: 0, z: -100 },
        desktopPos: { x: 150, y: 40, z: -20 },
        text: "More to come soon!"
    },
    {
        mobilePos: { x: 60, y: 0, z: -100 },
        desktopPos: { x: 150, y: 30, z: -20 },
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
let titleText = null;
let scrollHintText = null;
let linkedInCube = null;
let linkedInCubeHovered = false;
let linkedInCubeScale = LINKEDIN_CUBE_SCALE_MIN;
let linkedInCubeScaleGrowing = true;
let linkedInCubeAnimating = false;
let isMobile = isMobileView();
const stars = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function isMobileView() {
    return window.innerWidth < MOBILE_BREAKPOINT;
}

function getModelPos(section) {
    return isMobileView() ? section.mobilePos : section.desktopPos;
}

function getTextPos(section) {
    return isMobileView() ? section.mobilePos : section.desktopPos;
}

function getLinkedInCubePos() {
    return isMobileView() ? LINKEDIN_CUBE_POS.mobilePos : LINKEDIN_CUBE_POS.desktopPos;
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

function revealTextMesh(textMesh) {
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

function hideTextMesh(textMesh, duration = TEXT_HIDE_DURATION) {
    if (!textMesh) return Promise.resolve();

    stopTextAnimation(textMesh);

    const full = textMesh.userData.fullText;
    const state = { length: full.length };
    setTextByLength(textMesh, full.length);

    return new Promise((resolve) => {
        textMesh.userData.textTween = gsap.to(state, {
            length: 0,
            duration,
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

function revealSectionText(index) {
    return revealTextMesh(sectionTexts[index]);
}

function hideSectionText(index) {
    return hideTextMesh(sectionTexts[index]);
}

function revealTitleText() {
    return revealTextMesh(titleText);
}

function hideTitleText() {
    return hideTextMesh(titleText, HOME_TEXT_HIDE_DURATION);
}

function revealScrollHintText() {
    return revealTextMesh(scrollHintText);
}

function hideScrollHintText() {
    return hideTextMesh(scrollHintText, HOME_TEXT_HIDE_DURATION);
}

function toVerticalText(text) {
    return text.split("").join("\n");
}

function generateStars() {
    const geometry = new THREE.SphereGeometry(0.25, 24, 24);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const star = new THREE.Mesh(geometry, material);
    const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(800));
    star.position.set(x, y, z);
    scene.add(star);
    stars.push(star);
}

function animateStarsOnTransition() {
    stars.forEach((star) => {
        gsap.killTweensOf(star.position);
        gsap.to(star.position, {
            x: star.position.x + THREE.MathUtils.randFloatSpread(STAR_DRIFT_DISTANCE),
            y: star.position.y + THREE.MathUtils.randFloatSpread(STAR_DRIFT_DISTANCE),
            z: star.position.z + THREE.MathUtils.randFloatSpread(STAR_DRIFT_DISTANCE),
            duration: SCROLL_DURATION,
            ease: "power2.inOut"
        });
    });
}

Array(STAR_COUNT).fill().forEach(generateStars);

function createTitleText() {
    const outText = new Text();
    const pos = TITLE_TEXT_POS;

    outText.userData.fullText = TITLE_TEXT;
    outText.text = "";
    outText.font = TITLE_FONT;
    outText.fontSize = TITLE_FONT_SIZE;
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

function createScrollHintText() {
    const outText = new Text();
    const pos = SCROLL_HINT_TEXT_POS;
    const verticalText = toVerticalText(SCROLL_HINT_TEXT);

    outText.userData.fullText = verticalText;
    outText.text = "";
    outText.font = TEXT_FONT;
    outText.fontSize = SCROLL_HINT_FONT_SIZE;
    outText.color = 0xffffff;
    outText.maxWidth = TEXT_MAX_WIDTH;
    outText.position.set(pos.x, pos.y, pos.z);
    outText.textAlign = "center";
    outText.anchorX = "center";
    outText.anchorY = "top";
    outText.visible = false;
    outText.sync();

    scene.add(outText);
    return outText;
}

function createSectionText(section) {
    const outText = new Text();
    const pos = getTextPos(section);

    outText.userData.fullText = section.text;
    outText.text = "";
    outText.font = TEXT_FONT;
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
    titleText = createTitleText();
    scrollHintText = createScrollHintText();
    sectionTexts = TEXT_SECTIONS.map((section) => createSectionText(section));
}

function createLinkedInCube() {
    const texture = new THREE.TextureLoader().load(LINKEDIN_TEXTURE_PATH);
    const pos = getLinkedInCubePos();

    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(LINKEDIN_CUBE_SIZE, LINKEDIN_CUBE_SIZE, LINKEDIN_CUBE_SIZE),
        new THREE.MeshBasicMaterial({ map: texture })
    );

    cube.position.set(pos.x, pos.y, pos.z);
    cube.visible = false;
    scene.add(cube);
    return cube;
}

function setLinkedInCubeVisible(visible) {
    if (!linkedInCube) return;

    linkedInCube.visible = visible;

    if (!visible) {
        linkedInCubeHovered = false;
        linkedInCubeScale = LINKEDIN_CUBE_SCALE_MIN;
        linkedInCube.scale.set(
            LINKEDIN_CUBE_SCALE_MIN,
            LINKEDIN_CUBE_SCALE_MIN,
            LINKEDIN_CUBE_SCALE_MIN
        );
        canvas.style.cursor = "default";
    }
}

function stopLinkedInCubeAnimation() {
    if (!linkedInCube) return;

    gsap.killTweensOf(linkedInCube.position);
    linkedInCubeAnimating = false;
}

function getLinkedInCubeTargetPos() {
    const pos = getLinkedInCubePos();
    return { x: pos.x, y: pos.y, z: pos.z };
}

function animateLinkedInCubeIn() {
    return new Promise((resolve) => {
        if (!linkedInCube) {
            resolve();
            return;
        }

        stopLinkedInCubeAnimation();

        const target = getLinkedInCubeTargetPos();
        linkedInCube.position.set(
            target.x - LINKEDIN_CUBE_SLIDE_OFFSET,
            target.y,
            target.z
        );
        linkedInCubeAnimating = true;
        setLinkedInCubeVisible(true);

        gsap.to(linkedInCube.position, {
            x: target.x,
            y: target.y,
            z: target.z,
            duration: LINKEDIN_CUBE_ANIM_DURATION,
            ease: "power2.out",
            onComplete: () => {
                linkedInCubeAnimating = false;
                resolve();
            }
        });
    });
}

function animateLinkedInCubeOut(duration = LINKEDIN_CUBE_EXIT_ANIM_DURATION) {
    return new Promise((resolve) => {
        if (!linkedInCube || !linkedInCube.visible) {
            resolve();
            return;
        }

        stopLinkedInCubeAnimation();

        const target = getLinkedInCubeTargetPos();
        linkedInCube.position.set(target.x, target.y, target.z);
        linkedInCubeAnimating = true;

        gsap.to(linkedInCube.position, {
            x: target.x + LINKEDIN_CUBE_SLIDE_OFFSET,
            y: target.y,
            z: target.z,
            duration,
            ease: "power2.in",
            onComplete: () => {
                setLinkedInCubeVisible(false);
                linkedInCube.position.set(target.x, target.y, target.z);
                linkedInCubeAnimating = false;
                resolve();
            }
        });
    });
}

function spinLinkedInCube() {
    if (!linkedInCube || !linkedInCube.visible) return;

    linkedInCube.rotation.x += LINKEDIN_CUBE_SPIN_X;
    linkedInCube.rotation.y += LINKEDIN_CUBE_SPIN_Y;
    linkedInCube.rotation.z += LINKEDIN_CUBE_SPIN_Z;
}

function updateLinkedInCubeHover() {
    if (!linkedInCube || !linkedInCube.visible || linkedInCubeAnimating) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(linkedInCube);

    if (intersects.length > 0) {
        if (!linkedInCubeHovered) {
            linkedInCubeHovered = true;
            linkedInCubeScale = LINKEDIN_CUBE_SCALE_MIN;
            linkedInCubeScaleGrowing = true;
        }

        if (linkedInCubeScaleGrowing) {
            linkedInCubeScale += LINKEDIN_CUBE_SCALE_STEP;
            if (linkedInCubeScale >= LINKEDIN_CUBE_SCALE_MAX) {
                linkedInCubeScaleGrowing = false;
            }
        } else {
            linkedInCubeScale -= LINKEDIN_CUBE_SCALE_STEP;
            if (linkedInCubeScale <= LINKEDIN_CUBE_SCALE_MIN) {
                linkedInCubeScaleGrowing = true;
            }
        }

        linkedInCube.scale.set(linkedInCubeScale, linkedInCubeScale, linkedInCubeScale);
        canvas.style.cursor = "pointer";
    } else if (linkedInCubeHovered) {
        linkedInCubeHovered = false;
        linkedInCubeScale = LINKEDIN_CUBE_SCALE_MIN;
        linkedInCube.scale.set(LINKEDIN_CUBE_SCALE_MIN, LINKEDIN_CUBE_SCALE_MIN, LINKEDIN_CUBE_SCALE_MIN);
        canvas.style.cursor = "default";
    }
}

function setupLinkedInCubeInteraction() {
    window.addEventListener("mousemove", (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener("click", () => {
        if (!linkedInCube || !linkedInCube.visible || linkedInCubeAnimating || isAnimating) return;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(linkedInCube);

        if (intersects.length > 0) {
            window.open(LINKEDIN_URL, "_blank", "noopener,noreferrer");
        }
    });
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

    if (titleText) {
        const titlePos = TITLE_TEXT_POS;
        titleText.position.set(titlePos.x, titlePos.y, titlePos.z);
        titleText.sync();
    }

    if (scrollHintText) {
        const hintPos = SCROLL_HINT_TEXT_POS;
        scrollHintText.position.set(hintPos.x, hintPos.y, hintPos.z);
        scrollHintText.sync();
    }

    if (linkedInCube && !linkedInCubeAnimating) {
        const cubePos = getLinkedInCubeTargetPos();
        linkedInCube.position.set(cubePos.x, cubePos.y, cubePos.z);
    }
}

function warmupSectionTexts() {
    const meshes = titleText
        ? [titleText, scrollHintText, ...sectionTexts].filter(Boolean)
        : sectionTexts;

    return Promise.all(
        meshes.map(
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
    if (oldIndex === 0) {
        await Promise.all([hideTitleText(), hideScrollHintText()]);
    }

    const leavingLinkedInSection = oldIndex === LINKEDIN_CUBE_SECTION_INDEX;
    const enteringLinkedInSection = newIndex === LINKEDIN_CUBE_SECTION_INDEX;
    const exitingLinkedInForward = leavingLinkedInSection && newIndex > LINKEDIN_CUBE_SECTION_INDEX;

    if (exitingLinkedInForward) {
        await animateLinkedInCubeOut();
    } else if (leavingLinkedInSection) {
        stopLinkedInCubeAnimation();
        setLinkedInCubeVisible(false);
    }

    currentIndex = newIndex;
    updateStatus();

    const target = MODEL_SECTIONS[currentIndex];
    const targetPos = getModelPos(target);
    animateStarsOnTransition();
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

    if (currentIndex === 0) {
        await Promise.all([
            revealSectionText(currentIndex),
            revealTitleText(),
            revealScrollHintText()
        ]);
    } else {
        await revealSectionText(currentIndex);
    }

    if (enteringLinkedInSection) {
        await animateLinkedInCubeIn();
    }

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
        linkedInCube = createLinkedInCube();
        setupLinkedInCubeInteraction();
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

    spinLinkedInCube();
    updateLinkedInCubeHover();

    renderer.render(scene, camera);
}

animate();
