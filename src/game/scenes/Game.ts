import { Scene, Input } from 'phaser';

const MOVE_SPEED = 200;
const JUMP_VELOCITY = -450;

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

        // Placeholder floor so there's something to land and jump from - real rooms come in a later step.
        const ground = this.add.rectangle(512, 740, 1024, 56, 0x3a3a4a);
        this.physics.add.existing(ground, true); // true = static body: affected by gravity/collisions but never moves

        this.player = this.add.rectangle(512, 600, 40, 60, 0xe0e0e0);
        this.physics.add.existing(this.player); // gives the rectangle a physics body, so gravity and velocity apply to it

        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        playerBody.setCollideWorldBounds(true);

        this.physics.add.collider(this.player, ground);

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
