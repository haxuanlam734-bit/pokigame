/**
 * TUREL-3D.JS - Tháp pháo Turel (Heavy Autocannon)
 * Tự động khóa mục tiêu, bắn tia đạn laser hạng nặng gây sát thương mạnh mẽ
 * Hỗ trợ nâng cấp cấp độ, bán hoàn tiền và di chuyển vị trí
 */

class Turel3D {
    constructor(x, z) {
        this.x = x;
        this.z = z;
        this.type = 'turel';

        this.angle = 0;
        this.targetAngle = 0;
        this.lastShotTime = 0;
        this.fireRate = CONFIG.TUREL_FIRE_RATE || 300;
        this.range = CONFIG.TUREL_RANGE || 40;
        this.damage = CONFIG.TUREL_DAMAGE || 25;
        this.rotationSpeed = CONFIG.TUREL_ROTATION_SPEED || 0.22;
        this.level = 1;
        this.upgradeSpent = 0;

        this.mesh3D = Renderer3D.create3DTurel(x, z);

        console.log('🗼 Turel 3D được tạo tại', x.toFixed(0), z.toFixed(0));
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

            if (this.mesh3D) {
                if (this.mesh3D.turretHead) {
                    this.mesh3D.turretHead.rotation.y = -this.angle + Math.PI / 2;
                } else {
                    this.mesh3D.rotation.y = -this.angle + Math.PI / 2;
                }
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

        // 1. Gây sát thương thực tế
        target.takeDamage(this.damage);

        // 2. Điểm xuất phát nòng pháo và điểm mục tiêu
        const startPos = new THREE.Vector3(this.x, 3.8, this.z);
        const endPos = new THREE.Vector3(target.x, (target.y || 0) + 0.8, target.z);

        // 3. Hiển thị tia đạn hạng nặng màu đỏ/cam
        if (typeof WeaponRenderer !== 'undefined' && WeaponRenderer.spawnTracer) {
            WeaponRenderer.spawnTracer(startPos, endPos, {
                color: 0xff3300,
                lifetime: 0.11
            });
            WeaponRenderer.createHitSpark(endPos);
        }
    }

    getUpgradeCost() {
        return Math.floor((CONFIG.TUREL_UPGRADE_BASE_COST || 160) * Math.pow(1.6, this.level - 1));
    }

    upgrade() {
        if (this.level >= (CONFIG.TUREL_MAX_LEVEL || 5)) return false;
        const cost = this.getUpgradeCost();
        this.level += 1;
        this.upgradeSpent += cost;
        this.damage = Math.round(this.damage * 1.35);
        this.range += 5;
        this.fireRate = Math.max(120, Math.round(this.fireRate * 0.85));

        // Nâng cấp visual: đổi màu đèn hoặc hiệu ứng
        if (this.mesh3D && this.mesh3D.statusLight) {
            const colors = [0x00ff88, 0x00e5ff, 0xffea00, 0xff8800, 0xff0044];
            this.mesh3D.statusLight.material.color.setHex(colors[Math.min(this.level - 1, colors.length - 1)]);
        }

        return true;
    }

    setPosition(x, z) {
        this.x = x;
        this.z = z;
        if (this.mesh3D) {
            this.mesh3D.position.set(x, 0, z);
            this.mesh3D.visible = true;
        }
    }

    refreshVisual() {
        const oldMesh = this.mesh3D;
        this.mesh3D = Renderer3D.create3DTurel(this.x, this.z);
        if (oldMesh && oldMesh.parent) oldMesh.parent.remove(oldMesh);
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
