/**
 * GUN-CONTROLLER.JS
 * Quản lý khởi tạo Model Súng 3D, Hiệu ứng Tia Lửa (Muzzle Flash) và Đạn bắn ra.
 */

class GunController {
    constructor(scene) {
        this.scene = scene;
        this.gunMesh = null;
        this.muzzleFlash = null;
        this.flashLight = null;

        // Quản lý đạn
        this.bullets = [];
        this.bulletSpeed = 120.0; // Tốc độ đạn bay (m/s)
        this.bulletMaxDistance = 200; // Khoảng cách tối đa trước khi tự hủy

        // Vị trí nòng súng trong không gian World (để bắn đạn và tạo tia lửa)
        this.muzzleWorldPosition = new THREE.Vector3();
    }

    /**
     * Tạo model súng Rifle 3D chi tiết và gắn vào nhân vật (playerGroup)
     */
    createGun(playerGroup) {
        this.gunMesh = new THREE.Group();

        // Vật liệu (Materials)
        const metalDarkMat = new THREE.MeshPhongMaterial({ color: 0x1a1d20, shininess: 80 });
        const metalGrayMat = new THREE.MeshPhongMaterial({ color: 0x4a4e51, shininess: 50 });
        const woodMat = new THREE.MeshPhongMaterial({ color: 0x5a3d28, shininess: 10 });
        const goldMat = new THREE.MeshPhongMaterial({ color: 0xd4af37, shininess: 100 });

        // 1. Thân súng chính (Receiver)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.35), metalDarkMat);
        receiver.position.set(0, 0, 0);
        this.gunMesh.add(receiver);

        // 2. Nòng súng (Barrel)
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 12), metalGrayMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, 0.38);
        this.gunMesh.add(barrel);

        // 3. Đầu nòng súng (Muzzle Brake)
        const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.08, 8), metalDarkMat);
        muzzleBrake.rotation.x = Math.PI / 2;
        muzzleBrake.position.set(0, 0.02, 0.62);
        this.gunMesh.add(muzzleBrake);

        // 4. Ốp lót tay (Handguard / Foregrip)
        const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.28), woodMat);
        handguard.position.set(0, 0.01, 0.28);
        this.gunMesh.add(handguard);

        // 5. Băng đạn nghiêng (Magazine)
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.1), metalGrayMat);
        mag.position.set(0, -0.15, 0.08);
        mag.rotation.x = -0.25;
        this.gunMesh.add(mag);

        // 6. Tay cầm súng (Pistol Grip)
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.08), woodMat);
        grip.position.set(0, -0.12, -0.12);
        grip.rotation.x = -0.4;
        this.gunMesh.add(grip);

        // 7. Báng súng (Stock)
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.25), woodMat);
        stock.position.set(0, -0.01, -0.28);
        this.gunMesh.add(stock);

        // 8. Thước ngắm (Sights)
        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), metalDarkMat);
        rearSight.position.set(0, 0.08, -0.1);
        this.gunMesh.add(rearSight);

        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), metalDarkMat);
        frontSight.position.set(0, 0.08, 0.55);
        this.gunMesh.add(frontSight);

        // ----------------- HIỆU ỨNG TIA LỬA (MUZZLE FLASH) -----------------
        const flashGeo = new THREE.ConeGeometry(0.08, 0.25, 6);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 });
        this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
        this.muzzleFlash.rotation.x = -Math.PI / 2;
        this.muzzleFlash.position.set(0, 0.02, 0.72); // Ngay trước đầu nòng
        this.gunMesh.add(this.muzzleFlash);

        // Ánh sáng bùng lên khi bắn
        this.flashLight = new THREE.PointLight(0xffaa00, 0, 5);
        this.flashLight.position.set(0, 0.02, 0.72);
        this.gunMesh.add(this.flashLight);

        // Đặt súng vào tay phải nhân vật
        this.gunMesh.position.set(0.38, 1.15, 0.25);
        playerGroup.add(this.gunMesh);
        playerGroup.gunController = this;

        return this.gunMesh;
    }

    /**
     * Lấy vị trí nòng súng trong tọa độ World
     */
    getMuzzleWorldPosition() {
        if (!this.muzzleFlash) return new THREE.Vector3();
        this.muzzleFlash.getWorldPosition(this.muzzleWorldPosition);
        return this.muzzleWorldPosition;
    }

    /**
     * Hàm gọi khi bắn súng
     */
    shoot(shootDirection) {
        if (!this.gunMesh) return;

        // 1. Kích hoạt hiệu ứng Tia Lửa (Muzzle Flash)
        this.muzzleFlash.material.opacity = 0.9;
        this.muzzleFlash.rotation.z = Math.random() * Math.PI; // Xoay ngẫu nhiên cho tự nhiên
        this.flashLight.intensity = 3.0;

        // Giảm độ sáng tia lửa sau 40ms
        setTimeout(() => {
            if (this.muzzleFlash) this.muzzleFlash.material.opacity = 0;
            if (this.flashLight) this.flashLight.intensity = 0;
        }, 40);

        // 2. Giật súng nhẹ (Recoil animation)
        this.gunMesh.position.z -= 0.08;
        this.gunMesh.rotation.x += 0.05;
        setTimeout(() => {
            if (this.gunMesh) {
                this.gunMesh.position.z += 0.08;
                this.gunMesh.rotation.x -= 0.05;
            }
        }, 60);

        // 3. Tạo Viên Đạn (Bullet Mesh)
        const bulletGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe100 }); // Đạn phát sáng vàng
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);

        // Lấy vị trí đầu nòng súng
        const muzzlePos = this.getMuzzleWorldPosition();
        bullet.position.copy(muzzlePos);

        // Hướng viên đạn theo hướng bắn
        const dir = shootDirection.clone().normalize();
        bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

        this.scene.add(bullet);

        // Lưu thông tin đạn để cập nhật di chuyển
        this.bullets.push({
            mesh: bullet,
            direction: dir,
            distanceTraveled: 0
        });
    }

    /**
     * Cập nhật chuyển động của tất cả các viên đạn (gọi trong vòng lặp Render/Update)
     */
    update(deltaTime) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            const moveDistance = this.bulletSpeed * deltaTime;

            // Di chuyển đạn
            b.mesh.position.addScaledVector(b.direction, moveDistance);
            b.distanceTraveled += moveDistance;

            // Xóa đạn khi bay quá xa
            if (b.distanceTraveled >= this.bulletMaxDistance) {
                this.scene.remove(b.mesh);
                b.mesh.geometry.dispose();
                b.mesh.material.dispose();
                this.bullets.splice(i, 1);
            }
        }
    }
}