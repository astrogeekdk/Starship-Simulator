import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import * as CANNON from 'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js';



const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('container').appendChild(renderer.domElement);

const controls = new OrbitControls( camera, renderer.domElement );


const world = new CANNON.World();
world.gravity.set(0, -9.81, 0); 


const rocketGeometry = new THREE.CylinderGeometry(0.5, 0.5, 6, 32);
const rocketMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const rocketMesh = new THREE.Mesh(rocketGeometry, rocketMaterial);
scene.add(rocketMesh);


const rocketShape = new CANNON.Cylinder(0.5, 0.5, 6, 32);
const rocketBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(0, 3, 0)
});
rocketBody.addShape(rocketShape);
world.addBody(rocketBody);


const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x212121 });
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.rotation.x = -Math.PI / 2;
scene.add(groundMesh);


const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({
    mass: 0, 
    position: new CANNON.Vec3(0, 0, 0)
});
groundBody.addShape(groundShape);
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);


camera.position.set(0, 5, 10);
camera.lookAt(0,0,0);


let time = 0;

function animate() {
    requestAnimationFrame(animate);

    world.step(1/60);

    time += 1/60;

    let thrust;

    if (time>3 && time<5){
        thrust = new CANNON.Vec3(0.01,12,0);
    } else {
        thrust = new CANNON.Vec3(0,12,0);
    }
    
    const thrustPoint = new CANNON.Vec3(0,-3,0);
    rocketBody.applyLocalForce(thrust, thrustPoint);


    rocketMesh.position.copy(rocketBody.position);
    rocketMesh.quaternion.copy(rocketBody.quaternion);

    renderer.render(scene, camera);

}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});