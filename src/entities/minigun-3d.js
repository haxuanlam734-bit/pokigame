/**
 * MINIGUN-3D.JS - Súng máy Minigun (model 3D thật), đặt trong hộp
 * Mua trong hộp (crate) tốn tiền, tốc độ bắn cực nhanh, sát thương liên tục
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
        this.range = CONFIG.MINIGUN_RANGE || 32;
        this.damage = CONFIG.MINIGUN_DAMAGE || 8;
        this.rotationSpeed = CONFIG.MINIGUN_ROTATION_SPEED || 0.3;

        this.spinSpeed = 0;
        this.currentSpin = 0;

        this.mesh3D = Renderer3D.create3DMinigun(x, z);

        console.log('⚙️ Minigun 3D (hộp) được tạo tại', x.toFixed(0), z.toFixed(0));
    }

    findNearestZombie(zombies) {
        let nearest = null;
        let minDistance = this.range;
        for (const zombie of zombies) {
            const dist = Math.hypot((this.x - zombie.x), (this.z - zombie.z));
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
            this.spinSpeed = Math.min(this.spinSpeed + deltaSec * 30, 25);

            if (this.mesh3D && this.mesh3D.gunHead) {
                this.mesh3D.gunHead.rotation.y = this.angle;
            } else if (this.mesh3D) {
                this.mesh3D.rotation.y = this.angle;
            }

            const now = Date.now();
            if (now - this.lastShotTime >= this.fireRate && this.spinSpeed > 12) {
                this.shoot(bullets, target);
                this.lastShotTime = now;
            }
        } else {
            this.spinSpeed = Math.max(0, this.spinSpeed - deltaSec * 10);
        }

        this.currentSpin += this.spinSpeed * deltaSec;
        if (this.mesh3D && this.mesh3D.barrel) {
            this.mesh3D.barrel.rotation.z = this.currentSpin;
        }
    }

    shoot(bullets, target) {
        bullets.push({
            x: this.x,
            z: this.z,
            targetX: target.x,
            targetZ: target.z,
            speed: CONFIG.BULLET_SPEED * 1.2,
            damage: this.damage,
            traveled: 0,
            maxDistance: this.range * 1.5,
            isMinigun: true,
            update: function(deltaTime) {
                const deltaSec = deltaTime / 1000;
                const dist = Math.hypot(this.targetX - this.x, this.targetZ - this.z);
                if (dist > 0.1) {
                    const vx = (this.targetX - this.x) / dist * this.speed;
                    const vz = (this.targetZ - this.z) / dist * this.speed;
                    this.x += vx * deltaSec;
                    this.z += vz * deltaSec;
                    this.traveled += this.speed * deltaSec;
                }
            }
        });
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
