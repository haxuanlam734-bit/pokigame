/**
 * TUREL-3D.JS - Tháp pháo Turel (model 3D thật)
 * Xây dựng tùy ý trong phạm vi căn cứ, bắn xa và mạnh hơn tháp thường
 */

class Turel3D {
    constructor(x, z) {
        this.x = x;
        this.z = z;
        this.type = 'turel';

        this.angle = 0;
        this.targetAngle = 0;
        this.lastShotTime = 0;
        this.fireRate = CONFIG.TUREL_FIRE_RATE || 320;
        this.range = CONFIG.TUREL_RANGE || 38;
        this.damage = CONFIG.TUREL_DAMAGE || 22;
        this.rotationSpeed = CONFIG.TUREL_ROTATION_SPEED || 0.18;

        this.mesh3D = Renderer3D.create3DTurel(x, z);

        console.log('🗼 Turel 3D được tạo tại', x.toFixed(0), z.toFixed(0));
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
        if (!zombies || zombies.length === 0) return;
        const target = this.findNearestZombie(zombies);
        if (target) {
            this.targetAngle = Math.atan2(target.z - this.z, target.x - this.x);
            let diff = this.targetAngle - this.angle;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            this.angle += Math.max(-this.rotationSpeed, Math.min(this.rotationSpeed, diff));

            if (this.mesh3D && this.mesh3D.turretHead) {
                this.mesh3D.turretHead.rotation.y = this.angle;
            } else if (this.mesh3D) {
                this.mesh3D.rotation.y = this.angle;
            }

            const now = Date.now();
            if (now - this.lastShotTime >= this.fireRate) {
                this.shoot(bullets, target);
                this.lastShotTime = now;
            }
        }
    }

    shoot(bullets, target) {
        bullets.push({
            x: this.x,
            z: this.z,
            targetX: target.x,
            targetZ: target.z,
            speed: CONFIG.BULLET_SPEED,
            damage: this.damage,
            traveled: 0,
            maxDistance: this.range * 1.5,
            isTurel: true,
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
    module.exports = Turel3D;
}
