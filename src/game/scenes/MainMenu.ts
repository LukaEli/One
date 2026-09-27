import { Scene, GameObjects } from 'phaser';
import type { LifeStage } from './Game';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    subtitle: GameObjects.Text;
    stageButtons: Record<LifeStage, GameObjects.Rectangle>;
    selectedStage: LifeStage = 'Teen';

    constructor ()
    {
        super('MainMenu');
    }

    private startGame (): void
    {
        this.registry.set('lifeStage', this.selectedStage);
        this.scene.start('Game', { lifeStage: this.selectedStage });
    }

    private selectStage (stage: LifeStage): void
    {
        this.selectedStage = stage;
        for (const [buttonStage, button] of Object.entries(this.stageButtons) as [LifeStage, GameObjects.Rectangle][]) {
            const selected = buttonStage === stage;
            button.setFillStyle(selected ? 0x1f624e : 0x202638, selected ? 1 : 0.9);
            button.setStrokeStyle(selected ? 3 : 1, selected ? 0x6ee7b7 : 0x64748b, 1);
        }
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'background');

        this.logo = this.add.image(512, 220, 'logo');

        this.title = this.add.text(512, 360, 'LIFE-STAGE TEST RUN', {
            fontFamily: 'Arial Black', fontSize: 32, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.subtitle = this.add.text(512, 408, 'Choose a debug life stage', {
            fontFamily: 'Arial', fontSize: 18, color: '#eaeaea',
            stroke: '#000000', strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        const stageOptions: { stage: LifeStage; x: number; description: string }[] = [
            { stage: 'Baby', x: 282, description: 'Small  |  Fast  |  Light hit' },
            { stage: 'Teen', x: 512, description: 'Balanced' },
            { stage: 'Adult', x: 742, description: 'Large  |  Slow  |  Heavy hit' }
        ];
        this.stageButtons = {
            Baby: this.add.rectangle(282, 515, 210, 82, 0x202638, 0.9),
            Teen: this.add.rectangle(512, 515, 210, 82, 0x202638, 0.9),
            Adult: this.add.rectangle(742, 515, 210, 82, 0x202638, 0.9)
        };
        for (const option of stageOptions) {
            const button = this.stageButtons[option.stage].setInteractive({ useHandCursor: true });
            this.add.text(option.x, 499, option.stage, {
                fontFamily: 'Arial Black', fontSize: 20, color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            this.add.text(option.x, 530, option.description, {
                fontFamily: 'Arial', fontSize: 12, color: '#cbd5e1',
                align: 'center'
            }).setOrigin(0.5);
            button.on('pointerdown', () => this.selectStage(option.stage));
        }
        this.selectStage(this.selectedStage);

        const startButton = this.add.rectangle(512, 635, 260, 52, 0x34d399).setInteractive({ useHandCursor: true });
        this.add.text(512, 635, 'START RUN', {
            fontFamily: 'Arial Black', fontSize: 20, color: '#0f172a',
            align: 'center'
        }).setOrigin(0.5);
        startButton.on('pointerdown', this.startGame, this);
        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (event.key === '1') this.selectStage('Baby');
            if (event.key === '2') this.selectStage('Teen');
            if (event.key === '3') this.selectStage('Adult');
        });
        this.input.keyboard?.once('keydown-SPACE', this.startGame, this);
        this.input.keyboard?.once('keydown-ENTER', this.startGame, this);
    }
}
