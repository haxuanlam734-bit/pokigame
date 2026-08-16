/**
 * MINIGUN-3D.JS - Súng máy Minigun trong hộp (Crate Minigun)
 * Tốc độ bắn cực nhanh, gây sát thương liên tục lên bầy zombie
 */

class Minigun3D {
    constructor(x, z) {
        this.x = x;
        this.z = z;
        this.type = 'minigun';

        this.angle = 0;
        this.targetAngle = 0;
        this.lastShotTime = 0;
        this.fireRate = CONFIG.MINIGUN_FIRE_RATE || 90;
        this.range = CONFIG.MINIGUN_RANGE || 34;
        this.damage = CONFIG.MINIGUN_DAMAGE || 9;
        this.rotationSpeed = CONFIG.MINIGUN_ROTATION_SPEED || 0.35;

        this.spinSpeed = 0;
        this.currentSpin = 0;

        this.mesh3D = Renderer3D.create3DMinigun(x, z);

        console.log('⚙️ Minigun 3D (hộp) được tạo tại', x.toFixed(0), z.toFixed(0));
    }

    findNearestZombie(zombies) {
        let nearest = null;
        let minDistance = this.range;

        for (let i = 0; i < zombies.length; i++) {
            const zombie = zombies[i];
            if (!zombie || zombie.hp <= 0) continue;

            const dist = Math.hypot(this.x - zombie.x, this.z - zombie.z);
            if (dist < minDistance) {
                minDistance = dist;
                nearest = zombie;
            }
        }
        return nearest;
    }

    update(deltaTime, zombies, bullets) {
        const deltaSec = deltaTime / 1000;
        const hasTarget = zombies && zombies.length > 0;
        const target = hasTarget ? this.findNearestZombie(zombies) : null;

        if (target) {
            this.targetAngle = Math.atan2(target.z - this.z, target.x - this.x);

            let diff = this.targetAngle - this.angle;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            this.angle += Math.max(-this.rotationSpeed, Math.min(this.rotationSpeed, diff));
            this.spinSpeed = Math.min(this.spinSpeed + deltaSec * 35, 30);

            if (this.mesh3D) {
                if (this.mesh3D.gunHead) {
                    this.mesh3D.gunHead.rotation.y = -this.angle + Math.PI / 2;
                } else {
                    this.mesh3D.rotation.y = -this.angle + Math.PI / 2;
                }
            }

            const now = Date.now();
            if (now - this.lastShotTime >= this.fireRate && this.spinSpeed > 10) {
                this.shoot(target);
                this.lastShotTime = now;
            }
        } else {
            this.spinSpeed = Math.max(0, this.spinSpeed - deltaSec * 12);
        }

        this.currentSpin += this.spinSpeed * deltaSec;
        if (this.mesh3D && this.mesh3D.barrel) {
            this.mesh3D.barrel.rotation.z = this.currentSpin;
        }
    }

    shoot(target) {
        if (!target || target.hp <= 0) return;

        // 1. Gây sát thương thực tế
        target.takeDamage(this.damage);

        // 2. Điểm xuất phát nòng súng và mục tiêu
        const startPos = new THREE.Vector3(this.x, 2.0, this.z);
        const endPos = new THREE.Vector3(target.x, (target.y || 0) + 0.7, target.z);

        // 3. Hiển thị tia đạn Minigun màu cam/vàng rực rỡ
        if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer.spawnTracer) {
            WeaponRenderer.spawnTracer(startPos, endPos, {
                color: 0xffaa00,
                lifetime: 0.08
            });
            WeaponRenderer.createHitSpark(endPos);
        }
    }

    dispose() {
        if (this.mesh3D && this.mesh3D.parent) {
            Renderer3D.scene.remove(this.mesh3D);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Minigun3D;
}
