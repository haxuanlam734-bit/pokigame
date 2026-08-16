/**
 * TOWER-3D.JS - Tháp pháo laser trong 3D
 * Tự động khóa mục tiêu và bắn tia laser gây sát thương thực tế
 */

class Tower3D {
    constructor(x, z) {
        this.x = x;
        this.z = z;
        this.type = 'tower';

        this.angle = 0;
        this.targetAngle = 0;
        this.lastShotTime = 0;
        this.fireRate = CONFIG.TOWER_FIRE_RATE || 500;
        this.range = CONFIG.TOWER_RANGE || 25;
        this.damage = CONFIG.TOWER_DAMAGE || 15;
        this.rotationSpeed = CONFIG.TOWER_ROTATION_SPEED || 0.12;

        this.mesh3D = Renderer3D.create3DTower(x, z);

        console.log('🔫 Tháp pháo 3D được tạo tại', x.toFixed(0), z.toFixed(0));
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
        if (!zombies || zombies.length === 0) return;

        const target = this.findNearestZombie(zombies);
        if (target) {
            this.targetAngle = Math.atan2(target.z - this.z, target.x - this.x);

            let diff = this.targetAngle - this.angle;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            this.angle += Math.max(-this.rotationSpeed, Math.min(this.rotationSpeed, diff));

            if (this.mesh3D && this.mesh3D.cone) {
                this.mesh3D.cone.rotation.y = this.angle;
            }

            const now = Date.now();
            if (now - this.lastShotTime >= this.fireRate) {
                this.shoot(target);
                this.lastShotTime = now;
            }
        }
    }

    shoot(target) {
        if (!target || target.hp <= 0) return;

        // 1. Gây sát thương trực tiếp cho Zombie
        target.takeDamage(this.damage);

        // 2. Điểm xuất phát (đỉnh tháp) và điểm đích (thân zombie)
        const startPos = new THREE.Vector3(this.x, 6.2, this.z);
        const endPos = new THREE.Vector3(target.x, (target.y || 0) + 0.8, target.z);

        // 3. Hiển thị tia laser Cyan rực rỡ
        if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer.spawnTracer) {
            WeaponRenderer.spawnTracer(startPos, endPos, {
                color: 0x00e5ff,
                lifetime: 0.09
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
    module.exports = Tower3D;
}
