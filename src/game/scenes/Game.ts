import { Scene, Input } from 'phaser';

const MOVE_SPEED = 200;
const JUMP_VELOCITY = -450;

// The room is much wider than the 1024-wide camera viewport, so the player can walk/scroll through it.
const ROOM_WIDTH = 2400;
const ROOM_HEIGHT = 768;

export class Game extends Scene
{
    player: Phaser.GameObjects.Rectangle;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;

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
        }

        this.player = this.add.rectangle(100, 600, 40, 60, 0xe0e0e0);
        this.physics.add.existing(this.player); // gives the rectangle a physics body, so gravity and velocity apply to it

        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        playerBody.setCollideWorldBounds(true);

        this.physics.add.collider(this.player, platforms);

        // Camera follows the player but won't scroll past the room bounds set above.
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        this.cursors = this.input.keyboard!.createCursorKeys();
    }

    update ()
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
    }
}
