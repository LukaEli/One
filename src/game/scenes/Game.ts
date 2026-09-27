import { Scene, Input } from 'phaser';

const MOVE_SPEED = 200;
const JUMP_VELOCITY = -450;

// The room is much wider than the 1024-wide camera viewport, so the player can walk/scroll through it.
const ROOM_WIDTH = 2400;
const ROOM_HEIGHT = 768;

const FIRE_RATE_MS = 500; // how often the player auto-fires, regardless of input
const BULLET_SPEED = 500;

const ENEMY_COLOR = 0xd94f4f;
const TARGET_COLOR = 0xffa53c; // highlight for whichever enemy is currently being aimed at

// A bullet is just a shape that moves at a fixed velocity - no physics body needed for a straight line.
type Bullet = {
    shape: Phaser.GameObjects.Arc;
    velocityX: number;
    velocityY: number;
};

function distanceSquared (ax: number, ay: number, bx: number, by: number): number
{
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
}

export class Game extends Scene
{
    player: Phaser.GameObjects.Rectangle;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;

    // Placeholder targets with no health/death yet - that's the next build step. These just give
    // the auto-fire something to aim at so we can see and test it working.
    enemies: Phaser.GameObjects.Rectangle[] = [];
    bullets: Bullet[] = [];
    platformRects: Phaser.GameObjects.Rectangle[] = [];

    currentTarget: Phaser.GameObjects.Rectangle | undefined;
    targetLine: Phaser.GameObjects.Graphics;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
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

        this.cursors = this.input.keyboard!.createCursorKeys();

        const enemySpots: [x: number, y: number][] = [
            [900, 700],
            [1400, 700],
            [2000, 700]
        ];
        for (const [x, y] of enemySpots) {
            this.enemies.push(this.add.rectangle(x, y, 40, 40, ENEMY_COLOR));
        }

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

        if (this.cursors.left.isDown) {
            body.setVelocityX(-MOVE_SPEED);
        } else if (this.cursors.right.isDown) {
            body.setVelocityX(MOVE_SPEED);
        } else {
            body.setVelocityX(0);
        }

        // blocked.down / touching.down is true only while standing on something - stops mid-air jumps.
        const onGround = body.blocked.down || body.touching.down;
        if (onGround && Input.Keyboard.JustDown(this.cursors.up)) {
            body.setVelocityY(JUMP_VELOCITY);
        }

        this.updateTargetIndicator();
        this.updateBullets(delta);
    }

    findNearestEnemy (): Phaser.GameObjects.Rectangle | undefined
    {
        let nearest: Phaser.GameObjects.Rectangle | undefined;
        let nearestDistanceSquared = Infinity;

        for (const enemy of this.enemies) {
            const distSq = distanceSquared(this.player.x, this.player.y, enemy.x, enemy.y);
            if (distSq < nearestDistanceSquared) {
                nearestDistanceSquared = distSq;
                nearest = enemy;
            }
        }

        return nearest;
    }

    // Recomputes the nearest enemy every frame, highlights it, and draws a line to it so it's
    // obvious - while testing - who's about to get shot, even before the next bullet fires.
    updateTargetIndicator ()
    {
        const target = this.findNearestEnemy();

        if (target !== this.currentTarget) {
            this.currentTarget?.setFillStyle(ENEMY_COLOR);
            target?.setFillStyle(TARGET_COLOR);
            this.currentTarget = target;
        }

        this.targetLine.clear();
        if (target) {
            this.targetLine.lineStyle(2, TARGET_COLOR, 0.5);
            this.targetLine.lineBetween(this.player.x, this.player.y, target.x, target.y);
        }
    }

    fireAtNearestEnemy ()
    {
        const target = this.currentTarget;
        if (!target) {
            return;
        }

        // atan2 gives the angle from the player to the target; cos/sin split it into x/y speed.
        const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x);

        this.bullets.push({
            shape: this.add.circle(this.player.x, this.player.y, 6, 0xffe066),
            velocityX: Math.cos(angle) * BULLET_SPEED,
            velocityY: Math.sin(angle) * BULLET_SPEED
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
            const hitEnemy = this.enemies.some((enemy) => {
                const bounds = enemy.getBounds();
                const closestX = Math.max(bounds.left, Math.min(bullet.shape.x, bounds.right));
                const closestY = Math.max(bounds.top, Math.min(bullet.shape.y, bounds.bottom));
                return distanceSquared(bullet.shape.x, bullet.shape.y, closestX, closestY) <= bullet.shape.radius ** 2;
            });

            if (outOfBounds || hitPlatform || hitEnemy) {
                bullet.shape.destroy();
                this.bullets.splice(i, 1);
            }
        }
    }
}
