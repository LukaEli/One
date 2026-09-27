import { Scene, GameObjects } from 'phaser';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    subtitle: GameObjects.Text;

    constructor ()
    {
        super('MainMenu');
    }

    private startGame (): void
    {
        this.scene.start('Game');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'background');

        this.logo = this.add.image(512, 300, 'logo');

        this.title = this.add.text(512, 460, 'Main Menu', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.subtitle = this.add.text(512, 520, 'Click or press Space/Enter to start', {
            fontFamily: 'Arial', fontSize: 20, color: '#eaeaea',
            stroke: '#000000', strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        this.input.once('pointerdown', this.startGame, this);
        this.input.keyboard?.once('keydown-SPACE', this.startGame, this);
        this.input.keyboard?.once('keydown-ENTER', this.startGame, this);
    }
}
