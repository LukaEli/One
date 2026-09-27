import { Scene } from 'phaser';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Rectangle;
    gameoverText: Phaser.GameObjects.Text;

    constructor ()
    {
        super('GameOver');
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x111827);

        this.background = this.add.rectangle(512, 384, 1024, 768, 0x111827, 0.9);

        this.gameoverText = this.add.text(512, 300, 'DEFEAT', {
            fontFamily: 'Arial Black',
            fontSize: 64,
            color: '#f8fafc',
            stroke: '#000000',
            strokeThickness: 10,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(512, 370, 'Run ended', {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#cbd5e1',
            align: 'center'
        }).setOrigin(0.5);

        this.addActionButton(512, 460, 'Restart Run', 0x34d399, () => {
            this.scene.start('Game', { lifeStage: this.registry.get('lifeStage') });
        });

        this.addActionButton(512, 525, 'Main Menu', 0x475569, () => {
            this.scene.start('MainMenu');
        });

        this.input.keyboard?.once('keydown-SPACE', () => {
            this.scene.start('Game', { lifeStage: this.registry.get('lifeStage') });
        });

        this.input.keyboard?.once('keydown-M', () => {
            this.scene.start('MainMenu');
        });
    }

    private addActionButton (x: number, y: number, label: string, color: number, action: () => void)
    {
        const button = this.add.rectangle(x, y, 240, 48, color).setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#0f172a',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        button.on('pointerover', () => button.setAlpha(0.8));
        button.on('pointerout', () => button.setAlpha(1));
        button.on('pointerdown', action);
        text.setInteractive({ useHandCursor: true }).on('pointerdown', action);
    }
}
