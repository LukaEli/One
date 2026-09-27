import { Scene, Input, Geom } from 'phaser';

const MOVE_SPEED = 200;
const JUMP_VELOCITY = -450;

// The room is much wider than the 1024-wide camera viewport, so the player can walk/scroll through it.
const ROOM_WIDTH = 2400;
const ROOM_HEIGHT = 768;

const FIRE_RATE_MS = 500; // how often the player auto-fires, regardless of input
const BULLET_SPEED = 500;
const ENEMY_BULLET_SPEED = 260;
const PLAYER_MAX_HEALTH = 5;
const PLAYER_DAMAGE_COOLDOWN_MS = 600;
const ENEMY_MAX_HEALTH = 5;
const ENEMY_DAMAGE = 1;

const ENEMY_COLOR = 0xd94f4f;
const TARGET_COLOR = 0xffa53c; // highlight for whichever enemy is currently being aimed at

// A bullet is just a shape that moves at a fixed velocity - no physics body needed for a straight line.
type Bullet = {
    shape: Phaser.GameObjects.Arc;
    velocityX: number;
    velocityY: number;
    owner: 'player' | 'enemy';
    damage: number;
};

type Enemy = {
    body: Phaser.GameObjects.Rectangle;
    health: number;
    maxHealth: number;
    damage: number;
    fireCooldown: number;
    healthBar: Phaser.GameObjects.Graphics;
    healthText: Phaser.GameObjects.Text;
};

type DamagePopup = {
    text: Phaser.GameObjects.Text;
    ttl: number;
};

type Pickup = {
    shape: Phaser.GameObjects.Arc;
    type: 'xp' | 'coin';
    value: number;
};

function distanceSquared (ax: number, ay: number, bx: number, by: number): number
{
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
}

function lineIntersectsRect (ax: number, ay: number, bx: number, by: number, rect: Phaser.Geom.Rectangle): boolean
{
    const dx = bx - ax;
    const dy = by - ay;
    let tMin = 0;
    let tMax = 1;

    const checks: Array<[number, number]> = [
        [-dx, ax - rect.left],
        [dx, rect.right - ax],
        [-dy, ay - rect.top],
        [dy, rect.bottom - ay]
    ];

    for (const [p, q] of checks) {
        if (p === 0 && q < 0) {
            return false;
        }

        if (p < 0) {
            tMin = Math.max(tMin, q / p);
        } else if (p > 0) {
            tMax = Math.min(tMax, q / p);
        }
    }

    return tMin <= tMax;
}

type MovementKeys = Phaser.Types.Input.Keyboard.CursorKeys & {
    up: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    arrowUp: Phaser.Input.Keyboard.Key;
    arrowLeft: Phaser.Input.Keyboard.Key;
    arrowRight: Phaser.Input.Keyboard.Key;
    arrowDown: Phaser.Input.Keyboard.Key;
};

export class Game extends Scene
{
    player: Phaser.GameObjects.Rectangle;
    cursors: MovementKeys;
    playerHealth: number = PLAYER_MAX_HEALTH;
    contactDamageCooldown: number = 0;
    playerHealthBar: Phaser.GameObjects.Graphics;
    playerHealthText: Phaser.GameObjects.Text;
    uiContainer: Phaser.GameObjects.Container;
    uiHpLabel: Phaser.GameObjects.Text;
    playerXp: number = 0;
    playerCoins: number = 0;

    enemies: Enemy[] = [];
    bullets: Bullet[] = [];
    pickups: Pickup[] = [];
    platformRects: Phaser.GameObjects.Rectangle[] = [];
    damagePopups: DamagePopup[] = [];

    currentTarget: Enemy | undefined;
    targetLine: Phaser.GameObjects.Graphics;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.playerHealth = PLAYER_MAX_HEALTH;
        this.contactDamageCooldown = 0;
        this.playerXp = 0;
        this.playerCoins = 0;
        this.enemies = [];
        this.bullets = [];
        this.pickups = [];
        this.platformRects = [];
        this.damagePopups = [];
        this.currentTarget = undefined;

        this.cameras.main.setBackgroundColor(0x1d1d2b);

        // A room is bigger than the screen, so both the physics world and the camera need to know its real size -
        // otherwise the player would hit an invisible wall at the old 1024px edge and the camera would never scroll.
        this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

        // Static group: one collider for many fixed platforms, instead of adding a separate collider per rectangle.
        const platforms = this.physics.add.staticGroup();

        const ground = this.add.rectangle(ROOM_WIDTH / 2, 740, ROOM_WIDTH, 56, 0x3a3a4a);
        platforms.add(ground);
        this.platformRects.push(ground);

        // An ascending staircase: each platform is one jump higher than the last, so only the
        // first one is reachable straight from the ground - the rest require jumping platform-to-platform.
        const floatingPlatformSpots: [x: number, y: number][] = [
            [300, 650],
            [700, 560],
            [1100, 470],
            [1500, 380],
            [1900, 290]
        ];
        for (const [x, y] of floatingPlatformSpots) {
            const platform = this.add.rectangle(x, y, 220, 32, 0x3a3a4a);
            platforms.add(platform);
            this.platformRects.push(platform);
        }

        this.player = this.add.rectangle(100, 600, 40, 60, 0xe0e0e0);
        this.physics.add.existing(this.player); // gives the rectangle a physics body, so gravity and velocity apply to it

        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        playerBody.setCollideWorldBounds(true);

        this.physics.add.collider(this.player, platforms);

        // Camera follows the player but won't scroll past the room bounds set above.
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        this.cursors = this.input.keyboard!.addKeys({
            up: Input.Keyboard.KeyCodes.W,
            left: Input.Keyboard.KeyCodes.A,
            right: Input.Keyboard.KeyCodes.D,
            down: Input.Keyboard.KeyCodes.S,
            arrowUp: Input.Keyboard.KeyCodes.UP,
            arrowLeft: Input.Keyboard.KeyCodes.LEFT,
            arrowRight: Input.Keyboard.KeyCodes.RIGHT,
            arrowDown: Input.Keyboard.KeyCodes.DOWN
        }) as MovementKeys;

        const enemySpots: [x: number, y: number][] = [
            [900, 700],
            [1400, 700],
            [2000, 700]
        ];
        for (const [x, y] of enemySpots) {
            const body = this.add.rectangle(x, y, 40, 40, ENEMY_COLOR);
            this.physics.add.existing(body);
            const bodyPhysics = body.body as Phaser.Physics.Arcade.Body;
            bodyPhysics.setImmovable(true);
            bodyPhysics.setAllowGravity(false);

            const healthBar = this.add.graphics();
            const healthText = this.add.text(x, y - 32, `${ENEMY_MAX_HEALTH}`, {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            }).setOrigin(0.5);

            const enemy: Enemy = {
                body,
                health: ENEMY_MAX_HEALTH,
                maxHealth: ENEMY_MAX_HEALTH,
                damage: ENEMY_DAMAGE,
                fireCooldown: 600 + Math.random() * 500,
                healthBar,
                healthText
            };

            this.updateEnemyHealthBar(enemy);
            this.enemies.push(enemy);
        }

        const panel = this.add.rectangle(110, 42, 200, 70, 0x111827, 0.8);
        const title = this.add.text(20, 16, 'PLAYER', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#e5e7eb',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        });
        this.uiHpLabel = this.add.text(20, 34, `HP ${this.playerHealth}/${PLAYER_MAX_HEALTH}  XP ${this.playerXp}  C ${this.playerCoins}`, {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            fontStyle: 'bold'
        });
        this.uiContainer = this.add.container(18, 12, [panel, title, this.uiHpLabel]);

        this.playerHealthBar = this.add.graphics();
        this.playerHealthText = this.add.text(this.player.x, this.player.y - 46, `${this.playerHealth}`, {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
        this.updatePlayerHealthBar();

        this.targetLine = this.add.graphics();

        // A repeating timer, independent of movement/jump input, so firing never pauses for either.
        this.time.addEvent({
            delay: FIRE_RATE_MS,
            loop: true,
            callback: this.fireAtNearestEnemy,
            callbackScope: this
        });
    }

    update (_time: number, delta: number)
    {
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        this.contactDamageCooldown = Math.max(0, this.contactDamageCooldown - delta);

        const leftHeld = this.cursors.left?.isDown || this.cursors.arrowLeft?.isDown;
        const rightHeld = this.cursors.right?.isDown || this.cursors.arrowRight?.isDown;
        const jumpPressed = Input.Keyboard.JustDown(this.cursors.up) || Input.Keyboard.JustDown(this.cursors.arrowUp);

        if (leftHeld) {
            body.setVelocityX(-MOVE_SPEED);
        } else if (rightHeld) {
            body.setVelocityX(MOVE_SPEED);
        } else {
            body.setVelocityX(0);
        }

        // blocked.down / touching.down is true only while standing on something - stops mid-air jumps.
        const onGround = body.blocked.down || body.touching.down;
        if (onGround && jumpPressed) {
            body.setVelocityY(JUMP_VELOCITY);
        }

        for (const enemy of this.enemies) {
            this.updateEnemyHealthBar(enemy);
            this.updateEnemyFire(enemy, delta);
        }

        this.updatePlayerHealthBar();
        this.updateDamagePopups(delta);
        this.updatePickups(delta);
        this.handleEnemyContactDamage();
        this.checkPlayerDefeat();
        this.updateTargetIndicator();
        this.updateBullets(delta);
    }

    updatePlayerHealthBar ()
    {
        const barWidth = 52;
        const barHeight = 8;
        const healthRatio = Math.max(0, Math.min(1, this.playerHealth / PLAYER_MAX_HEALTH));
        const x = this.player.x;
        const y = this.player.y - 42;

        this.playerHealthBar.clear();
        this.playerHealthBar.fillStyle(0x000000, 0.8);
        this.playerHealthBar.fillRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight);
        this.playerHealthBar.fillStyle(0xf87171, 1);
        this.playerHealthBar.fillRect(x - barWidth / 2, y - barHeight / 2, barWidth * healthRatio, barHeight);
        this.playerHealthBar.lineStyle(1, 0xffffff, 0.8);
        this.playerHealthBar.strokeRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight);

        this.playerHealthText.setPosition(x, y - 12);
        this.playerHealthText.setText(`${this.playerHealth}`);
        this.uiHpLabel.setText(`HP ${this.playerHealth}/${PLAYER_MAX_HEALTH} • XP ${this.playerXp} • Coins ${this.playerCoins}`);
    }

    checkPlayerDefeat ()
    {
        if (this.playerHealth <= 0 && this.scene.isActive('Game')) {
            this.scene.start('GameOver');
        }
    }

    updateDamagePopups (delta: number)
    {
        for (let i = this.damagePopups.length - 1; i >= 0; i--) {
            const popup = this.damagePopups[i];
            popup.ttl -= delta;
            popup.text.y -= 0.08 * delta;
            popup.text.alpha = Math.max(0, popup.ttl / 300);

            if (popup.ttl <= 0) {
                popup.text.destroy();
                this.damagePopups.splice(i, 1);
            }
        }
    }

    hasLineOfSight (fromX: number, fromY: number, toX: number, toY: number): boolean
    {
        for (const platform of this.platformRects) {
            const bounds = platform.getBounds();
            if (lineIntersectsRect(fromX, fromY, toX, toY, bounds)) {
                return false;
            }
        }

        return true;
    }

    isOnScreen (x: number, y: number): boolean
    {
        const cameraBounds = this.cameras.main.worldView;
        return cameraBounds.contains(x, y);
    }

    isEnemyVisible (enemy: Enemy): boolean
    {
        const cameraBounds = this.cameras.main.worldView;
        const enemyBounds = enemy.body.getBounds();
        return Geom.Intersects.RectangleToRectangle(cameraBounds, enemyBounds);
    }

    findNearestEnemy (): Enemy | undefined
    {
        const visibleEnemies = this.enemies.filter((enemy) => this.isEnemyVisible(enemy));
        if (visibleEnemies.length === 0) {
            return undefined;
        }

        let nearest: Enemy | undefined;
        let nearestDistanceSquared = Infinity;

        for (const enemy of visibleEnemies) {
            const distSq = distanceSquared(this.player.x, this.player.y, enemy.body.x, enemy.body.y);
            if (distSq < nearestDistanceSquared) {
                nearestDistanceSquared = distSq;
                nearest = enemy;
            }
        }

        return nearest;
    }

    // Recomputes the nearest visible enemy every frame, highlights it, and draws a line to it so it's
    // obvious - while testing - who's about to get shot, even before the next bullet fires.
    updateTargetIndicator ()
    {
        const target = this.findNearestEnemy();

        if (target !== this.currentTarget) {
            this.currentTarget?.body.setFillStyle(ENEMY_COLOR);
            target?.body.setFillStyle(TARGET_COLOR);
            this.currentTarget = target;
        }

        this.targetLine.clear();
        if (target) {
            this.targetLine.lineStyle(2, TARGET_COLOR, 0.5);
            this.targetLine.lineBetween(this.player.x, this.player.y, target.body.x, target.body.y);
        }
    }

    handleEnemyContactDamage ()
    {
        if (this.contactDamageCooldown > 0) {
            return;
        }

        const playerBounds = this.player.getBounds();
        for (const enemy of this.enemies) {
            const enemyBounds = enemy.body.getBounds();
            if (Geom.Intersects.RectangleToRectangle(playerBounds, enemyBounds)) {
                this.playerHealth = Math.max(0, this.playerHealth - enemy.damage);
                this.contactDamageCooldown = PLAYER_DAMAGE_COOLDOWN_MS;
                this.player.setFillStyle(0xff6666);
                this.time.delayedCall(120, () => this.player.setFillStyle(0xe0e0e0));
                this.updatePlayerHealthBar();
                this.checkPlayerDefeat();
                return;
            }
        }
    }

    updateEnemyHealthBar (enemy: Enemy)
    {
        const barWidth = 36;
        const barHeight = 6;
        const healthRatio = Math.max(0, Math.min(1, enemy.health / enemy.maxHealth));
        const x = enemy.body.x;
        const y = enemy.body.y - 28;

        enemy.healthBar.clear();
        enemy.healthBar.fillStyle(0x000000, 0.8);
        enemy.healthBar.fillRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight);
        enemy.healthBar.fillStyle(0x4ade80, 1);
        enemy.healthBar.fillRect(x - barWidth / 2, y - barHeight / 2, barWidth * healthRatio, barHeight);
        enemy.healthBar.lineStyle(1, 0xffffff, 0.8);
        enemy.healthBar.strokeRect(x - barWidth / 2, y - barHeight / 2, barWidth, barHeight);

        enemy.healthText.setPosition(x, y - 12);
        enemy.healthText.setText(`${enemy.health}`);
    }

    spawnEnemyDrops (x: number, y: number)
    {
        const xp = this.add.circle(x, y, 6, 0x34d399).setStrokeStyle(2, 0xd1fae5, 1);
        const coin = this.add.circle(x + 9, y - 4, 4, 0xfacc15).setStrokeStyle(2, 0xfef3c7, 1);

        this.pickups.push({ shape: xp, type: 'xp', value: 10 });
        this.pickups.push({ shape: coin, type: 'coin', value: 1 });
    }

    updatePickups (delta: number)
    {
        const deltaSeconds = delta / 1000;

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pickup = this.pickups[i];
            const dx = this.player.x - pickup.shape.x;
            const dy = this.player.y - pickup.shape.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 140) {
                const pullStrength = 260 * deltaSeconds;
                pickup.shape.x += (dx / Math.max(distance, 1)) * pullStrength;
                pickup.shape.y += (dy / Math.max(distance, 1)) * pullStrength;
            }

            if (distance < 22) {
                if (pickup.type === 'xp') {
                    this.playerXp += pickup.value;
                } else {
                    this.playerCoins += pickup.value;
                }

                const popupMessage = pickup.type === 'xp' ? '+10 XP' : '+1 Coin';
                const popup = this.add.text(this.player.x, this.player.y - 34, popupMessage, {
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    color: pickup.type === 'xp' ? '#b7f7d0' : '#fde68a',
                    stroke: '#000000',
                    strokeThickness: 3,
                    fontStyle: 'bold'
                }).setOrigin(0.5);
                this.damagePopups.push({ text: popup, ttl: 320 });

                pickup.shape.destroy();
                this.pickups.splice(i, 1);
                this.updatePlayerHealthBar();
            }
        }
    }

    damageEnemy (enemy: Enemy)
    {
        enemy.health -= 1;
        enemy.body.setFillStyle(0xff8a66);
        this.updateEnemyHealthBar(enemy);

        const popup = this.add.text(enemy.body.x, enemy.body.y - 52, '-1', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffb3b3',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);
        this.damagePopups.push({ text: popup, ttl: 350 });

        if (enemy.health <= 0) {
            this.spawnEnemyDrops(enemy.body.x, enemy.body.y);
            enemy.body.destroy();
            enemy.healthBar.destroy();
            enemy.healthText.destroy();
            this.enemies = this.enemies.filter((candidate) => candidate !== enemy);
            this.currentTarget = this.findNearestEnemy();
            this.updateTargetIndicator();
            return;
        }

        this.time.delayedCall(80, () => enemy.body.setFillStyle(ENEMY_COLOR));
    }

    updateEnemyFire (enemy: Enemy, delta: number)
    {
        enemy.fireCooldown -= delta;
        const distanceToPlayer = distanceSquared(enemy.body.x, enemy.body.y, this.player.x, this.player.y);
        const visibleAndInRange = distanceToPlayer <= 700 * 700;
        const canSeePlayer = this.hasLineOfSight(enemy.body.x, enemy.body.y, this.player.x, this.player.y);
        const bothVisible = this.isOnScreen(enemy.body.x, enemy.body.y) && this.isOnScreen(this.player.x, this.player.y);

        if (enemy.fireCooldown > 0 || !visibleAndInRange || !canSeePlayer || !bothVisible) {
            return;
        }

        const angle = Math.atan2(this.player.y - enemy.body.y, this.player.x - enemy.body.x);
        this.bullets.push({
            shape: this.add.circle(enemy.body.x, enemy.body.y, 5, 0x9ca3af),
            velocityX: Math.cos(angle) * ENEMY_BULLET_SPEED,
            velocityY: Math.sin(angle) * ENEMY_BULLET_SPEED,
            owner: 'enemy',
            damage: enemy.damage
        });
        enemy.fireCooldown = 1200 + Math.random() * 600;
    }

    fireAtNearestEnemy ()
    {
        const target = this.currentTarget;
        if (!target) {
            return;
        }

        const canSeeTarget = this.hasLineOfSight(this.player.x, this.player.y, target.body.x, target.body.y);
        const bothVisible = this.isOnScreen(this.player.x, this.player.y) && this.isOnScreen(target.body.x, target.body.y);
        if (!canSeeTarget || !bothVisible) {
            return;
        }

        const distanceToTarget = distanceSquared(this.player.x, this.player.y, target.body.x, target.body.y);
        if (distanceToTarget > 700 * 700) {
            return;
        }

        // atan2 gives the angle from the player to the target; cos/sin split it into x/y speed.
        const angle = Math.atan2(target.body.y - this.player.y, target.body.x - this.player.x);

        this.bullets.push({
            shape: this.add.circle(this.player.x, this.player.y, 6, 0xffe066),
            velocityX: Math.cos(angle) * BULLET_SPEED,
            velocityY: Math.sin(angle) * BULLET_SPEED,
            owner: 'player',
            damage: 1
        });
    }

    updateBullets (delta: number)
    {
        const deltaSeconds = delta / 1000;

        // Iterate backwards so removing a bullet mid-loop (splice) doesn't skip the next one.
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.shape.x += bullet.velocityX * deltaSeconds;
            bullet.shape.y += bullet.velocityY * deltaSeconds;

            const outOfBounds = bullet.shape.x < 0 || bullet.shape.x > ROOM_WIDTH
                || bullet.shape.y < 0 || bullet.shape.y > ROOM_HEIGHT;
            const hitPlatform = this.platformRects.some((platform) => platform.getBounds().contains(bullet.shape.x, bullet.shape.y));

            if (bullet.owner === 'player') {
                const hitEnemy = this.enemies.find((enemy) => {
                    const bounds = enemy.body.getBounds();
                    const closestX = Math.max(bounds.left, Math.min(bullet.shape.x, bounds.right));
                    const closestY = Math.max(bounds.top, Math.min(bullet.shape.y, bounds.bottom));
                    return distanceSquared(bullet.shape.x, bullet.shape.y, closestX, closestY) <= bullet.shape.radius ** 2;
                });

                if (outOfBounds || hitPlatform) {
                    bullet.shape.destroy();
                    this.bullets.splice(i, 1);
                    continue;
                }

                if (hitEnemy) {
                    this.damageEnemy(hitEnemy);
                    bullet.shape.destroy();
                    this.bullets.splice(i, 1);
                }
                continue;
            }

            const playerBounds = this.player.getBounds();
            const hitPlayer = playerBounds.contains(bullet.shape.x, bullet.shape.y);
            if (outOfBounds || hitPlatform || hitPlayer) {
                if (hitPlayer) {
                    this.playerHealth = Math.max(0, this.playerHealth - bullet.damage);
                    this.player.setFillStyle(0xff6666);
                    this.time.delayedCall(120, () => this.player.setFillStyle(0xe0e0e0));
                    this.checkPlayerDefeat();
                }
                bullet.shape.destroy();
                this.bullets.splice(i, 1);
            }
        }
    }
}
