import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import * as CANNON from 'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 10, 1000000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('container').appendChild(renderer.domElement);

const controls = new OrbitControls( camera, renderer.domElement );
const textureLoader = new THREE.TextureLoader();

const ambientLight = new THREE.AmbientLight(0x404040, 10);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

const skyR = 100000; 
const skyGeom = new THREE.SphereGeometry(skyR, 64, 64);
const skyTexture = textureLoader.load('milkyway.jpg');
const skyMaterial = new THREE.MeshPhongMaterial({
    map: skyTexture,
    side: THREE.DoubleSide,
});
const sky = new THREE.Mesh(skyGeom, skyMaterial);
sky.position.set(0, 0, 0);
scene.add(sky);



const earthRadius = 10000; 
const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
const earthTexture = textureLoader.load('earth_day.jpg');
const earthMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    side: THREE.DoubleSide,
});
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
earth.position.set(0, -earthRadius, 0); 
scene.add(earth);
earth.rotateX(THREE.MathUtils.degToRad(-63))
earth.rotateY(THREE.MathUtils.degToRad(-9))



const state = {
    phase: 'prelaunch', // 'prelaunch', 'launch', 'separated', 'orbit'
    altitude: 0,
    velocity: 0,
    boosterVelocity: 0,
    shipVelocity: 0,
    gravity: 0.05,
    rollAngle: 0,
    orbitAngle: 0,
    orbitRadius: earthRadius + 500 
};

const world = new CANNON.World()
world.gravity.set(0, -9.82, 0); // Earth-like gravity in m/s²

const loader = new GLTFLoader();
let booster, ship;

let boosterHeight = 0;
let shipHeight = 0;

let starshipBody, boosterBody, shipBody;


loader.load('booster.glb', (gltf) => {
    booster = gltf.scene;
    scene.add(booster);

    const box = new THREE.Box3().setFromObject(booster);
    boosterHeight = box.max.y - box.min.y;

    booster.scale.set(1, 1, 1);
    booster.position.set(0, 0, 0);

    loader.load('ship.glb', (gltf) => {
        ship = gltf.scene;
        scene.add(ship);

        const shipBox = new THREE.Box3().setFromObject(ship);
        shipHeight = shipBox.max.y - shipBox.min.y;

        ship.scale.set(1, 1, 1);

        ship.position.set(0, boosterHeight, 0);

        const totalHeight = boosterHeight + shipHeight;
        const starshipShape = new CANNON.Box(new CANNON.Vec3(5, totalHeight / 2, 5)); // Adjust size
        starshipBody = new CANNON.Body({
            mass: 1000000, // Total mass in kg
            shape: starshipShape,
        });
        starshipBody.position.set(0, totalHeight / 2, 0);
        world.addBody(starshipBody);

        setTimeout(() => {
            state.phase = 'launch';
            state.velocity = 0.5; 
        }, 1000); 

        
    });
});

function updateMeshes() {
    if (state.phase === 'prelaunch' || state.phase === 'launch') {
        // Combined Starship
        booster.position.copy(starshipBody.position);
        booster.position.y -= (boosterHeight + shipHeight) / 2 - boosterHeight / 2;
        ship.position.copy(starshipBody.position);
        ship.position.y += (boosterHeight + shipHeight) / 2 - shipHeight / 2;
        booster.quaternion.copy(starshipBody.quaternion);
        ship.quaternion.copy(starshipBody.quaternion);
    } else if (state.phase === 'separated') {
        // Separated Booster and Ship
        booster.position.copy(boosterBody.position);
        ship.position.copy(shipBody.position);
        booster.quaternion.copy(boosterBody.quaternion);
        ship.quaternion.copy(shipBody.quaternion);
    } else if (state.phase === 'orbit') {
        // Ship in Orbit, Booster Falling
        booster.position.copy(boosterBody.position);
        booster.quaternion.copy(boosterBody.quaternion);
        // Orbiting Ship (manual for simplicity)
        state.orbitAngle += 0.01;
        ship.position.x = state.orbitRadius * Math.cos(state.orbitAngle);
        ship.position.y = state.orbitRadius * Math.sin(state.orbitAngle) + earthRadius;
        ship.position.z = 0;
    }
}

camera.position.set(30, 0, 0);
camera.lookAt(0, 20, 0);

function animate() {
    requestAnimationFrame(animate);

    // code for launch, seperation, orbit

    if (state.phase === 'launch' || state.phase === 'separated' || state.phase === 'orbit') {
        world.step(1 / 60); // Fixed time step
    }

    if (state.phase === 'launch') {
        // Apply Thrust Force
        const thrustForce = new CANNON.Vec3(0, 100000000, 0); // Adjust magnitude
        starshipBody.applyForce(thrustForce, starshipBody.position);

        // Check for Separation
        if (starshipBody.position.y > 100) { // Arbitrary altitude
            state.phase = 'separated';

            // Remove Combined Body
            world.removeBody(starshipBody);

            // Booster Body
            const boosterShape = new CANNON.Box(new CANNON.Vec3(5, boosterHeight / 2, 5));
            boosterBody = new CANNON.Body({
                mass: 500000, // Half the mass
                shape: boosterShape,
            });
            boosterBody.position.copy(starshipBody.position);
            boosterBody.position.y -= (boosterHeight + shipHeight) / 2 - boosterHeight / 2;
            boosterBody.velocity.copy(starshipBody.velocity);
            world.addBody(boosterBody);

            // Ship Body
            const shipShape = new CANNON.Box(new CANNON.Vec3(5, shipHeight / 2, 5));
            shipBody = new CANNON.Body({
                mass: 500000, // Half the mass
                shape: shipShape,
            });
            shipBody.position.copy(starshipBody.position);
            shipBody.position.y += (boosterHeight + shipHeight) / 2 - shipHeight / 2;
            shipBody.velocity.copy(starshipBody.velocity);
            world.addBody(shipBody);
        }
    } else if (state.phase === 'separated' && shipBody.position.y > state.orbitRadius) {
        state.phase = 'orbit';
        world.removeBody(shipBody); // Switch to manual orbit
    }

    // Update Meshes
    if (booster && ship) {
        updateMeshes();
    }
    
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


