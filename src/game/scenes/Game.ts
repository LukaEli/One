import { Scene, Input, Geom } from 'phaser';
import { PlayerStats } from '../skills/PlayerStats';
import { SkillManager } from '../skills/SkillManager';
import { SkillData } from '../skills/SkillData';

const JUMP_VELOCITY = -450;

const ROOM_WIDTH = 1024;
const ROOM_HEIGHT = 768;
const ROOM_COUNT = 8;

type RoomTerrain = {
    backgroundColor: number;
    groundColor: number;
    platformColor: number;
    platforms: [x: number, y: number, width: number][];
};

const ROOM_TERRAINS: Record<number, RoomTerrain> = {
    1: {
        backgroundColor: 0x1d1d2b,
        groundColor: 0x3a3a4a,
        platformColor: 0x4a4653,
        platforms: [[260, 650, 220], [512, 560, 220], [764, 650, 220]]
    },
    2: {
        backgroundColor: 0x142b2b,
        groundColor: 0x354b45,
        platformColor: 0x4c665b,
        platforms: [[160, 650, 200], [400, 590, 190], [660, 650, 190], [870, 590, 180]]
    },
    3: {
        backgroundColor: 0x2b1c24,
        groundColor: 0x4b343c,
        platformColor: 0x68464b,
        platforms: [[190, 650, 190], [410, 590, 180], [630, 650, 180], [830, 570, 200]]
    },
    4: {
        backgroundColor: 0x1e2930,
        groundColor: 0x3e5556,
        platformColor: 0x52706c,
        platforms: [[180, 610, 190], [410, 680, 220], [680, 590, 190], [870, 660, 150]]
    },
    5: {
        backgroundColor: 0x28251e,
        groundColor: 0x514a37,
        platformColor: 0x716144,
        platforms: [[150, 670, 180], [370, 600, 180], [620, 660, 200], [850, 570, 180]]
    },
    6: {
        backgroundColor: 0x1b2430,
        groundColor: 0x394958,
        platformColor: 0x506275,
        platforms: [[160, 590, 180], [390, 660, 200], [650, 590, 200], [870, 660, 160]]
    },
    7: {
        backgroundColor: 0x29202d,
        groundColor: 0x514050,
        platformColor: 0x71566a,
        platforms: [[170, 660, 200], [420, 570, 180], [650, 660, 180], [870, 590, 180]]
    },
    8: {
        backgroundColor: 0x202b27,
        groundColor: 0x46574b,
        platformColor: 0x637457,
        platforms: [[160, 620, 180], [380, 680, 180], [620, 600, 200], [860, 650, 180]]
    }
};

const FIRE_RATE_MS = 500; // how often the player auto-fires, regardless of input
const BULLET_SPEED = 500;
const ENEMY_BULLET_SPEED = 260;
const PLAYER_MAX_HEALTH = 10;
const PLAYER_DAMAGE_COOLDOWN_MS = 600;
const ENEMY_MAX_HEALTH = 5;
const ENEMY_DAMAGE = 1;

const ENEMY_COLOR = 0xd94f4f;
const TARGET_COLOR = 0xffa53c; // highlight for whichever enemy is currently being aimed at
const BATTLE_XP_TO_PICK = 30;

export type LifeStage = 'Baby' | 'Teen' | 'Adult';

const PLAYER_COLORS: Record<LifeStage, number> = {
    Baby: 0xd6bd8a,
    Teen: 0x66857d,
    Adult: 0x778394
};

const LIFE_STAGE_STATS: Record<LifeStage, { width: number; height: number; moveSpeed: number; damage: number }> = {
    Baby: { width: 30, height: 42, moveSpeed: 240, damage: 1 },
    Teen: { width: 40, height: 60, moveSpeed: 200, damage: 2 },
    Adult: { width: 52, height: 72, moveSpeed: 170, damage: 3 }
};

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
    details: Phaser.GameObjects.Graphics;
    isFlying: boolean;
    flightOriginY: number;
    flightTimer: number;
    flightPhase: number;
    patrolLeft: number;
    patrolRight: number;
    moveDirection: number;
    moveSpeed: number;
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

type ImpactParticle = {
    shape: Phaser.GameObjects.Arc;
    velocityX: number;
    velocityY: number;
    ttl: number;
    maxTtl: number;
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
    lifeStage: LifeStage = 'Teen';
    playerStats: PlayerStats;
    skillManager: SkillManager = new SkillManager();
    playerHealth: number = PLAYER_MAX_HEALTH;
    contactDamageCooldown: number = 0;
    playerHealthBar: Phaser.GameObjects.Graphics;
    playerHealthText: Phaser.GameObjects.Text;
    uiContainer: Phaser.GameObjects.Container;
    uiHpLabel: Phaser.GameObjects.Text;
    uiTitle: Phaser.GameObjects.Text;
    xpBar: Phaser.GameObjects.Graphics;
    xpProgress: number = 0;
    currentSkillChoices: SkillData[] = [];
    skillOverlay: Phaser.GameObjects.Container | undefined;
    skillSelectionOpen: boolean = false;
    roomClearHandled: boolean = false;
    roomNumber: number = 1;
    roomPicksToSpend: number = 0;
    playerFireCooldown: number = FIRE_RATE_MS;
    audioContext: AudioContext | undefined;
    playerDetails: Phaser.GameObjects.Graphics;
    ground: Phaser.GameObjects.Rectangle;
    playerXp: number = 0;
    playerCoins: number = 0;

    enemies: Enemy[] = [];
    bullets: Bullet[] = [];
    pickups: Pickup[] = [];
    platformRects: Phaser.GameObjects.Rectangle[] = [];
    roomPlatforms: Record<number, Phaser.GameObjects.Rectangle[]> = {};
    damagePopups: DamagePopup[] = [];
    impactParticles: ImpactParticle[] = [];
    hitStopRemaining: number = 0;
    touchLeft: boolean = false;
    touchRight: boolean = false;
    touchJump: boolean = false;

    currentTarget: Enemy | undefined;
    targetLine: Phaser.GameObjects.Graphics;

    constructor ()
    {
        super('Game');
    }

    init (data: { lifeStage?: LifeStage })
    {
        this.lifeStage = data.lifeStage ?? 'Teen';
    }

    create ()
    {
        this.physics.world.resume();
        const stageStats = LIFE_STAGE_STATS[this.lifeStage];
        this.playerStats = new PlayerStats({
            damage: stageStats.damage,
            moveSpeed: stageStats.moveSpeed,
            fireRateMs: FIRE_RATE_MS,
            maxHealth: PLAYER_MAX_HEALTH,
            bulletSpeed: BULLET_SPEED,
            pickupRadius: 140,
            jumpVelocity: JUMP_VELOCITY,
            xpMultiplier: 1,
            bulletRadius: 6,
            roomHeal: 0,
            damageReduction: 0
        });
        this.skillManager = new SkillManager();
        this.playerHealth = this.playerStats.stats.maxHealth;
        this.contactDamageCooldown = 0;
        this.xpProgress = 0;
        this.playerXp = 0;
        this.roomNumber = 1;
        this.roomClearHandled = false;
        this.skillSelectionOpen = false;
        this.roomPicksToSpend = 0;
        this.currentSkillChoices = [];
        this.skillOverlay = undefined;
        this.playerFireCooldown = FIRE_RATE_MS;
        this.playerCoins = 0;
        this.enemies = [];
        this.bullets = [];
        this.pickups = [];
        this.platformRects = [];
        this.roomPlatforms = {};
        this.damagePopups = [];
        this.impactParticles = [];
        this.hitStopRemaining = 0;
        this.currentTarget = undefined;

        this.physics.world.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
        this.cameras.main.setBounds(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

        // Static group: one collider for many fixed platforms, instead of adding a separate collider per rectangle.
        const platforms = this.physics.add.staticGroup();

        this.ground = this.add.rectangle(ROOM_WIDTH / 2, 740, ROOM_WIDTH, 56, ROOM_TERRAINS[1].groundColor);
        platforms.add(this.ground);
        for (const [roomId, terrain] of Object.entries(ROOM_TERRAINS)) {
            const roomNumber = Number(roomId);
            this.roomPlatforms[roomNumber] = terrain.platforms.map(([x, y, width]) => {
                const platform = this.add.rectangle(x, y, width, 32, terrain.platformColor);
                platforms.add(platform);
                return platform;
            });
        }
        this.setRoomTerrain(this.roomNumber);

        this.player = this.add.rectangle(100, 600, stageStats.width, stageStats.height, PLAYER_COLORS[this.lifeStage]);
        this.playerDetails = this.add.graphics();
        this.drawPlayerAppearance();
        this.physics.add.existing(this.player); // gives the rectangle a physics body, so gravity and velocity apply to it

        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        playerBody.setCollideWorldBounds(true);

        this.physics.add.collider(this.player, platforms);

        this.cameras.main.stopFollow();
        this.cameras.main.centerOn(ROOM_WIDTH / 2, ROOM_HEIGHT / 2);

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
        this.createTouchControls();

        this.spawnRoomEnemies();

        const panel = this.add.rectangle(148, 44, 284, 82, 0x111827, 0.8);
        this.uiTitle = this.add.text(16, 8, `${this.lifeStage.toUpperCase()}  RUN  |  ROOM 1 / ${ROOM_COUNT}`, {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#e5e7eb',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        });
        this.uiHpLabel = this.add.text(16, 28, '', {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            fontStyle: 'bold'
        });
        this.xpBar = this.add.graphics();
        const pickLabel = this.add.text(238, 55, '', {
            fontFamily: 'Arial',
            fontSize: '11px',
            color: '#b7f7d0',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setName('banked-picks');
        this.uiContainer = this.add.container(12, 10, [panel, this.uiTitle, this.uiHpLabel, this.xpBar, pickLabel]).setScrollFactor(0);

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

        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            this.unlockAudio();
            if (!this.skillSelectionOpen) {
                return;
            }

            const choice = this.currentSkillChoices[Number(event.key) - 1];
            if (choice) {
                this.chooseSkill(choice.id);
            }
        });
        this.input.on('pointerdown', this.handleSkillCardPointer, this);
    }

    createTouchControls (): void
    {
        const createButton = (x: number, label: string, setHeld: (held: boolean) => void): void => {
            const button = this.add.circle(x, 684, 36, 0x111827, 0.55)
                .setStrokeStyle(2, 0xe2e8f0, 0.65)
                .setScrollFactor(0)
                .setDepth(50)
                .setInteractive({ useHandCursor: true });
            this.add.text(x, 684, label, {
                fontFamily: 'Arial Black',
                fontSize: 22,
                color: '#ffffff'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
            button.on('pointerdown', () => {
                this.unlockAudio();
                setHeld(true);
            });
            button.on('pointerup', () => setHeld(false));
            button.on('pointerout', () => setHeld(false));
        };

        createButton(58, '<', (held) => { this.touchLeft = held; });
        createButton(142, '>', (held) => { this.touchRight = held; });
        createButton(966, '^', (held) => { this.touchJump = held; });
    }

    spawnRoomEnemies (): void
    {
        const enemyCount = Math.min(6, 3 + Math.floor((this.roomNumber - 1) / 2));
        for (let index = 0; index < enemyCount; index++) {
            const x = ROOM_WIDTH * (index + 1) / (enemyCount + 1);
            const isFlying = this.roomNumber >= 2 && (index === 1 || (this.roomNumber >= 5 && index === 3));
            const y = isFlying ? 420 + (index % 2) * 75 : 700;
            const body = this.add.rectangle(x, y, 40, 40, ENEMY_COLOR);
            this.physics.add.existing(body);
            const bodyPhysics = body.body as Phaser.Physics.Arcade.Body;
            bodyPhysics.setImmovable(true);
            bodyPhysics.setAllowGravity(false);

            const details = this.add.graphics();

            const healthBar = this.add.graphics();
            const healthText = this.add.text(x, y - 46, `${ENEMY_MAX_HEALTH}`, {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            }).setOrigin(0.5);

            const enemy: Enemy = {
                body,
                details,
                isFlying,
                flightOriginY: y,
                flightTimer: 0,
                flightPhase: Math.random() * Math.PI * 2,
                patrolLeft: Math.max(65, x - 82),
                patrolRight: Math.min(ROOM_WIDTH - 65, x + 82),
                moveDirection: Math.random() < 0.5 ? -1 : 1,
                moveSpeed: 55 + this.roomNumber * 12,
                health: ENEMY_MAX_HEALTH,
                maxHealth: ENEMY_MAX_HEALTH,
                damage: ENEMY_DAMAGE,
                fireCooldown: 600 + Math.random() * 500,
                healthBar,
                healthText
            };

            this.drawEnemyDetails(enemy);
            this.updateEnemyHealthBar(enemy);
            this.enemies.push(enemy);
        }
    }

    drawEnemyDetails (enemy: Enemy): void
    {
        const { x, y } = enemy.body;
        const details = enemy.details;
        details.clear();
        if (enemy.isFlying) {
            details.fillStyle(0x572b4c, 1);
            details.fillTriangle(x - 15, y - 5, x - 38, y - 23, x - 31, y + 3);
            details.fillTriangle(x + 15, y - 5, x + 38, y - 23, x + 31, y + 3);
            details.fillStyle(0xb76b92, 1);
            details.fillTriangle(x - 14, y + 2, x - 32, y - 9, x - 25, y + 8);
            details.fillTriangle(x + 14, y + 2, x + 32, y - 9, x + 25, y + 8);
        }
        details.fillStyle(0x32121b, 1);
        details.fillTriangle(x - 14, y - 14, x - 21, y - 31, x - 5, y - 23);
        details.fillTriangle(x + 14, y - 14, x + 21, y - 31, x + 5, y - 23);
        details.fillTriangle(x - 18, y + 1, x - 26, y - 7, x - 19, y - 12);
        details.fillTriangle(x + 18, y + 1, x + 26, y - 7, x + 19, y - 12);
        details.fillStyle(0xffd166, 1);
        details.fillCircle(x - 8, y - 5, 5);
        details.fillCircle(x + 8, y - 5, 5);
        details.fillStyle(0x190d12, 1);
        details.fillCircle(x - 8, y - 5, 2);
        details.fillCircle(x + 8, y - 5, 2);
        details.fillRect(x - 11, y + 7, 22, 9);
        details.fillStyle(0xf7e6ce, 1);
        details.fillTriangle(x - 8, y + 7, x - 3, y + 7, x - 6, y + 13);
        details.fillTriangle(x - 1, y + 7, x + 4, y + 7, x + 1, y + 13);
        details.fillTriangle(x + 6, y + 7, x + 10, y + 7, x + 8, y + 12);
    }

    updateEnemyMovement (enemy: Enemy, delta: number): void
    {
        const nextX = enemy.body.x + enemy.moveDirection * enemy.moveSpeed * (delta / 1000);
        if (nextX <= enemy.patrolLeft || nextX >= enemy.patrolRight) {
            enemy.moveDirection *= -1;
        }

        enemy.body.x = Math.max(enemy.patrolLeft, Math.min(enemy.patrolRight, nextX));
        if (enemy.isFlying) {
            enemy.flightTimer += delta;
            enemy.body.y = enemy.flightOriginY + Math.sin(enemy.flightTimer * 0.002 + enemy.flightPhase) * 36;
        }
        this.drawEnemyDetails(enemy);
    }

    setRoomTerrain (roomNumber: number): void
    {
        const terrain = ROOM_TERRAINS[roomNumber];
        this.cameras.main.setBackgroundColor(terrain.backgroundColor);
        this.ground.setFillStyle(terrain.groundColor);
        this.platformRects = [this.ground];

        for (const [platformRoomId, roomPlatforms] of Object.entries(this.roomPlatforms)) {
            const active = Number(platformRoomId) === roomNumber;
            for (const platform of roomPlatforms) {
                platform.setVisible(active);
                (platform.body as Phaser.Physics.Arcade.StaticBody).enable = active;
                if (active) {
                    this.platformRects.push(platform);
                }
            }
        }
    }

    drawPlayerAppearance (): void
    {
        const x = this.player.x;
        const y = this.player.y;
        const halfWidth = this.player.width / 2;
        const halfHeight = this.player.height / 2;
        const top = y - halfHeight;
        const eyeY = y - halfHeight * 0.12;
        const eyeOffset = Math.min(9, halfWidth * 0.34);
        const details = this.playerDetails;

        details.clear();
        details.lineStyle(2, this.lifeStage === 'Baby' ? 0x493126 : 0x202427, 1);
        details.strokeRect(x - halfWidth, top, this.player.width, this.player.height);

        if (this.lifeStage === 'Baby') {
            details.fillStyle(0x493126, 1);
            details.fillCircle(x, top + 5, 4);
            details.fillTriangle(x - 2, top + 7, x + 2, top - 2, x + 6, top + 7);
            details.fillStyle(0xffd6af, 1);
            details.fillCircle(x - halfWidth + 2, y + 6, 4);
            details.fillCircle(x + halfWidth - 2, y + 6, 4);
        } else if (this.lifeStage === 'Teen') {
            details.fillStyle(0x202427, 1);
            details.fillRect(x - halfWidth * 0.4, top + 3, halfWidth * 0.8, 6);
            details.fillTriangle(x - 5, top + 6, x, top - 4, x + 2, top + 7);
            details.fillStyle(0xb97855, 1);
            details.fillCircle(x - halfWidth + 3, y + 4, 4);
            details.fillCircle(x + halfWidth - 3, y + 4, 4);
        } else {
            details.fillStyle(0x313946, 1);
            details.fillRect(x - halfWidth * 0.42, top + 4, halfWidth * 0.84, 8);
            details.fillTriangle(x - 5, top + 5, x, top - 5, x + 5, top + 5);
            details.fillTriangle(x - halfWidth, y - 4, x - halfWidth - 5, y + 7, x - halfWidth + 5, y + 9);
            details.fillTriangle(x + halfWidth, y - 4, x + halfWidth + 5, y + 7, x + halfWidth - 5, y + 9);
            details.fillStyle(0x313946, 1);
            details.fillCircle(x - halfWidth + 2, y + 8, 5);
            details.fillCircle(x + halfWidth - 2, y + 8, 5);
        }

        details.fillStyle(this.lifeStage === 'Adult' ? 0x8be1d0 : 0xffe5ad, 1);
        details.fillCircle(x - eyeOffset, eyeY, this.lifeStage === 'Baby' ? 3 : 2.5);
        details.fillCircle(x + eyeOffset, eyeY, this.lifeStage === 'Baby' ? 3 : 2.5);
        details.fillStyle(0x21191a, 1);
        details.fillCircle(x - eyeOffset, eyeY, 1.5);
        details.fillCircle(x + eyeOffset, eyeY, 1.5);

        if (this.lifeStage === 'Baby') {
            details.fillStyle(0xc97976, 0.8);
            details.fillCircle(x - halfWidth * 0.55, eyeY + 6, 2);
            details.fillCircle(x + halfWidth * 0.55, eyeY + 6, 2);
            details.fillStyle(0x62b9b0, 1);
            details.fillCircle(x, eyeY + 9, 3);
            details.lineStyle(1, 0xe7e0c5, 1);
            details.strokeCircle(x, eyeY + 9, 4);
            details.fillStyle(0xe8d7b7, 1);
            details.fillRect(x - halfWidth * 0.45, y + halfHeight * 0.38, halfWidth * 0.9, 5);
        } else if (this.lifeStage === 'Teen') {
            details.fillStyle(0x263536, 1);
            details.fillRect(x - halfWidth * 0.28, eyeY + 6, halfWidth * 0.56, 4);
            details.fillStyle(0xb97855, 1);
            details.fillRect(x - halfWidth * 0.38, y + halfHeight * 0.27, halfWidth * 0.76, 5);
            details.fillStyle(0xe4c36b, 1);
            details.fillRect(x - 3, y + halfHeight * 0.27, 6, 5);
        } else {
            details.fillStyle(0x313946, 1);
            details.fillRect(x - halfWidth * 0.36, eyeY + 6, halfWidth * 0.72, 7);
            details.fillStyle(0x8be1d0, 1);
            details.fillRect(x - halfWidth * 0.24, eyeY + 8, halfWidth * 0.48, 2);
            details.fillStyle(0xb7c3cf, 1);
            details.fillRect(x - halfWidth * 0.5, y + halfHeight * 0.22, this.player.width, 5);
            details.fillStyle(0x303944, 1);
            details.fillRect(x - halfWidth * 0.38, y + halfHeight * 0.38, halfWidth * 0.76, 8);
        }

        details.fillStyle(0x27272a, 1);
        details.fillRect(x - halfWidth * 0.48, y + halfHeight - 5, halfWidth * 0.42, 5);
        details.fillRect(x + halfWidth * 0.06, y + halfHeight - 5, halfWidth * 0.42, 5);
    }

    checkRoomClear (): void
    {
        if (this.enemies.length > 0 || this.roomClearHandled) {
            return;
        }

        this.roomClearHandled = true;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        playerBody.setVelocityX(0);
        for (const pickup of this.pickups) {
            this.collectPickup(pickup);
            pickup.shape.destroy();
        }
        this.pickups = [];

        if (this.skillManager.bankedPicks > 0) {
            this.roomPicksToSpend = this.skillManager.bankedPicks;
            this.showSkillChoices();
            return;
        }

        const clearText = this.add.text(512, 384, 'ROOM CLEAR', {
            fontFamily: 'Arial Black',
            fontSize: 40,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        this.time.delayedCall(700, () => {
            clearText.destroy();
            this.startNextRoom();
        });
    }

    showSkillChoices (): void
    {
        this.currentSkillChoices = this.skillManager.onLevelUp();
        this.skillSelectionOpen = true;
        this.skillOverlay?.destroy();

        const spentPicks = this.roomPicksToSpend - this.skillManager.bankedPicks + 1;
        const background = this.add.rectangle(512, 384, 1024, 768, 0x080b12, 0.9).setInteractive();
        const heading = this.add.text(512, 220, 'ROOM CLEAR', {
            fontFamily: 'Arial Black',
            fontSize: 38,
            color: '#f8fafc',
            stroke: '#000000',
            strokeThickness: 7,
            align: 'center'
        }).setOrigin(0.5);
        const prompt = this.add.text(512, 270, `PICK ${spentPicks} OF ${this.roomPicksToSpend}`, {
            fontFamily: 'Arial',
            fontSize: 18,
            color: '#a7f3d0',
            align: 'center'
        }).setOrigin(0.5);
        const overlayItems: Phaser.GameObjects.GameObject[] = [background, heading, prompt];
        const cardCenters = [182, 512, 842];

        this.currentSkillChoices.forEach((skill, index) => {
            const centerX = cardCenters[index];
            const card = this.add.rectangle(centerX, 405, 240, 230, 0x17202d, 1)
                .setStrokeStyle(2, 0x64748b, 1)
                .setInteractive({ useHandCursor: true });
            const name = this.add.text(centerX, 350, skill.name, {
                fontFamily: 'Arial Black',
                fontSize: 20,
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: 205 }
            }).setOrigin(0.5);
            const description = this.add.text(centerX, 415, skill.description, {
                fontFamily: 'Arial',
                fontSize: 16,
                color: '#cbd5e1',
                align: 'center',
                wordWrap: { width: 195 }
            }).setOrigin(0.5);

            card.on('pointerover', () => card.setFillStyle(0x26394b, 1));
            card.on('pointerout', () => card.setFillStyle(0x17202d, 1));
            overlayItems.push(card, name, description);
        });

        this.skillOverlay = this.add.container(0, 0, overlayItems).setScrollFactor(0).setDepth(100);
    }

    handleSkillCardPointer (pointer: Phaser.Input.Pointer): void
    {
        this.unlockAudio();
        if (!this.skillSelectionOpen || pointer.y < 290 || pointer.y > 520) {
            return;
        }

        const cardCenters = [182, 512, 842];
        const choiceIndex = cardCenters.findIndex((centerX) => pointer.x >= centerX - 120 && pointer.x <= centerX + 120);
        const choice = this.currentSkillChoices[choiceIndex];
        if (choice) {
            this.chooseSkill(choice.id);
        }
    }

    chooseSkill (skillId: string): void
    {
        const selectedSkill = this.skillManager.chooseSkill(skillId);
        if (!selectedSkill) {
            return;
        }

        const previousMaxHealth = this.playerStats.stats.maxHealth;
        this.playerStats.addSkill(selectedSkill);
        this.playJuiceSound('pickup');
        const healthIncrease = this.playerStats.stats.maxHealth - previousMaxHealth;
        this.playerHealth = Math.min(this.playerStats.stats.maxHealth, this.playerHealth + healthIncrease);
        this.updatePlayerHealthBar();

        if (this.skillManager.bankedPicks > 0) {
            this.showSkillChoices();
            return;
        }

        this.skillSelectionOpen = false;
        this.currentSkillChoices = [];
        this.skillOverlay?.destroy();
        this.skillOverlay = undefined;
        this.time.delayedCall(350, this.startNextRoom, [], this);
    }

    startNextRoom (): void
    {
        if (this.roomNumber >= ROOM_COUNT) {
            this.scene.start('GameOver', { victory: true, roomsCleared: ROOM_COUNT });
            return;
        }

        this.roomNumber += 1;
        this.playerHealth = Math.min(this.playerStats.stats.maxHealth, this.playerHealth + this.playerStats.stats.roomHeal);
        this.setRoomTerrain(this.roomNumber);
        this.roomClearHandled = false;
        this.playerFireCooldown = this.playerStats.stats.fireRateMs;
        this.uiTitle.setText(`${this.lifeStage.toUpperCase()}  RUN  |  ROOM ${this.roomNumber} / ${ROOM_COUNT}`);
        this.updatePlayerHealthBar();
        this.spawnRoomEnemies();
        this.currentTarget = this.findNearestEnemy();
        this.updateTargetIndicator();
    }

    update (_time: number, delta: number)
    {
        if (this.hitStopRemaining > 0) {
            this.hitStopRemaining -= delta;
            if (this.hitStopRemaining <= 0) {
                this.hitStopRemaining = 0;
                this.physics.world.resume();
            }
            return;
        }

        this.updateImpactParticles(delta);
        this.updateDamagePopups(delta);
        if (this.roomClearHandled) {
            return;
        }

        const body = this.player.body as Phaser.Physics.Arcade.Body;
        this.contactDamageCooldown = Math.max(0, this.contactDamageCooldown - delta);

        const leftHeld = this.touchLeft || this.cursors.left?.isDown || this.cursors.arrowLeft?.isDown;
        const rightHeld = this.touchRight || this.cursors.right?.isDown || this.cursors.arrowRight?.isDown;
        const jumpPressed = this.touchJump || Input.Keyboard.JustDown(this.cursors.up) || Input.Keyboard.JustDown(this.cursors.arrowUp);

        if (leftHeld) {
            body.setVelocityX(-this.playerStats.stats.moveSpeed);
        } else if (rightHeld) {
            body.setVelocityX(this.playerStats.stats.moveSpeed);
        } else {
            body.setVelocityX(0);
        }

        // blocked.down / touching.down is true only while standing on something - stops mid-air jumps.
        const onGround = body.blocked.down || body.touching.down;
        if (onGround && jumpPressed) {
            body.setVelocityY(this.playerStats.stats.jumpVelocity);
        }

        this.drawPlayerAppearance();

        for (const enemy of this.enemies) {
            this.updateEnemyMovement(enemy, delta);
            this.updateEnemyHealthBar(enemy);
            this.updateEnemyFire(enemy, delta);
        }

        this.updatePlayerHealthBar();
        this.updatePickups(delta);
        this.handleEnemyContactDamage();
        this.checkPlayerDefeat();
        this.updateTargetIndicator();
        this.updateAutoFire(delta);
        this.updateBullets(delta);
        this.checkRoomClear();
    }

    updateAutoFire (delta: number): void
    {
        this.playerFireCooldown -= delta;
        if (this.playerFireCooldown <= 0) {
            this.fireAtNearestEnemy();
            this.playerFireCooldown = this.playerStats.stats.fireRateMs;
        }
    }

    updatePlayerHealthBar ()
    {
        const barWidth = 52;
        const barHeight = 8;
        const healthRatio = Math.max(0, Math.min(1, this.playerHealth / this.playerStats.stats.maxHealth));
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
        this.uiHpLabel.setText(`HP ${this.playerHealth}/${this.playerStats.stats.maxHealth}   Coins ${this.playerCoins}`);
        this.xpBar.clear();
        this.xpBar.fillStyle(0x030712, 0.95);
        this.xpBar.fillRect(16, 55, 210, 10);
        this.xpBar.fillStyle(0x34d399, 1);
        this.xpBar.fillRect(16, 55, 210 * (this.xpProgress / BATTLE_XP_TO_PICK), 10);
        this.xpBar.lineStyle(1, 0xd1fae5, 0.8);
        this.xpBar.strokeRect(16, 55, 210, 10);
        const pickLabel = this.uiContainer.getByName('banked-picks') as Phaser.GameObjects.Text;
        pickLabel.setText(`PICKS ${this.skillManager.bankedPicks}`);
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

    spawnImpactParticles (x: number, y: number, color: number, count: number, speed: number): void
    {
        for (let index = 0; index < count; index++) {
            const angle = Math.random() * Math.PI * 2;
            const particleSpeed = speed * (0.45 + Math.random() * 0.55);
            const shape = this.add.circle(x, y, 2 + Math.random() * 2, color);
            this.impactParticles.push({
                shape,
                velocityX: Math.cos(angle) * particleSpeed,
                velocityY: Math.sin(angle) * particleSpeed,
                ttl: 260,
                maxTtl: 260
            });
        }
    }

    unlockAudio (): void
    {
        if (typeof AudioContext === 'undefined') {
            return;
        }

        this.audioContext ??= new AudioContext();
        if (this.audioContext.state === 'suspended') {
            void this.audioContext.resume();
        }
    }

    playJuiceSound (kind: 'hit' | 'kill' | 'hurt' | 'pickup'): void
    {
        const context = this.audioContext;
        if (!context || context.state !== 'running') {
            return;
        }

        const sounds = {
            hit: { start: 190, end: 95, duration: 0.07, volume: 0.045, waveform: 'triangle' as OscillatorType },
            kill: { start: 560, end: 260, duration: 0.15, volume: 0.055, waveform: 'square' as OscillatorType },
            hurt: { start: 135, end: 55, duration: 0.14, volume: 0.07, waveform: 'sawtooth' as OscillatorType },
            pickup: { start: 700, end: 920, duration: 0.06, volume: 0.035, waveform: 'sine' as OscillatorType }
        };
        const sound = sounds[kind];
        const startTime = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = sound.waveform;
        oscillator.frequency.setValueAtTime(sound.start, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(sound.end, startTime + sound.duration);
        gain.gain.setValueAtTime(sound.volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + sound.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + sound.duration);
    }

    updateImpactParticles (delta: number): void
    {
        const deltaSeconds = delta / 1000;
        for (let index = this.impactParticles.length - 1; index >= 0; index--) {
            const particle = this.impactParticles[index];
            particle.ttl -= delta;
            if (particle.ttl <= 0) {
                particle.shape.destroy();
                this.impactParticles.splice(index, 1);
                continue;
            }

            particle.velocityY += 260 * deltaSeconds;
            particle.shape.x += particle.velocityX * deltaSeconds;
            particle.shape.y += particle.velocityY * deltaSeconds;
            particle.shape.setAlpha(particle.ttl / particle.maxTtl);
            particle.shape.setScale(0.4 + 0.6 * (particle.ttl / particle.maxTtl));
        }
    }

    triggerHitStop (duration: number): void
    {
        this.hitStopRemaining = Math.max(this.hitStopRemaining, duration);
        this.physics.world.pause();
    }

    playPlayerDamageFeedback (): void
    {
        this.cameras.main.shake(160, 0.016);
        this.spawnImpactParticles(this.player.x, this.player.y, 0xff6666, 12, 190);
        this.playJuiceSound('hurt');
        this.triggerHitStop(85);
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
                this.playerHealth = Math.max(0, this.playerHealth - enemy.damage * (1 - this.playerStats.stats.damageReduction));
                this.contactDamageCooldown = PLAYER_DAMAGE_COOLDOWN_MS;
                this.player.setFillStyle(0xff6666);
                this.playPlayerDamageFeedback();
                this.time.delayedCall(120, () => this.player.setFillStyle(PLAYER_COLORS[this.lifeStage]));
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
        const y = enemy.body.y - 42;

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

            if (distance < this.playerStats.stats.pickupRadius) {
                const pullStrength = 260 * deltaSeconds;
                pickup.shape.x += (dx / Math.max(distance, 1)) * pullStrength;
                pickup.shape.y += (dy / Math.max(distance, 1)) * pullStrength;
            }

            if (distance < 22) {
                this.collectPickup(pickup);

                pickup.shape.destroy();
                this.pickups.splice(i, 1);
                this.updatePlayerHealthBar();
            }
        }
    }

    collectPickup (pickup: Pickup): void
    {
        if (pickup.type === 'xp') {
            const xpGained = pickup.value * this.playerStats.stats.xpMultiplier;
            this.playerXp += xpGained;
            this.xpProgress += xpGained;
            while (this.xpProgress >= BATTLE_XP_TO_PICK) {
                this.xpProgress -= BATTLE_XP_TO_PICK;
                this.skillManager.bankPick();
            }
        } else {
            this.playerCoins += pickup.value;
        }

        const isXp = pickup.type === 'xp';
        if (isXp && !this.roomClearHandled) {
            this.playJuiceSound('pickup');
        }
        const xpGained = pickup.value * this.playerStats.stats.xpMultiplier;
        const popupMessage = isXp ? `+${xpGained} XP` : `+${pickup.value} Coin`;
        const popup = this.add.text(this.player.x, this.player.y - 34, popupMessage, {
            fontFamily: 'Arial',
            fontSize: '12px',
            color: isXp ? '#b7f7d0' : '#fde68a',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.damagePopups.push({ text: popup, ttl: 320 });
        this.updatePlayerHealthBar();
    }

    damageEnemy (enemy: Enemy, damage: number)
    {
        enemy.health = Math.max(0, enemy.health - damage);
        const killed = enemy.health <= 0;
        enemy.body.setFillStyle(0xff8a66);
        this.cameras.main.shake(killed ? 130 : 55, killed ? 0.012 : 0.004);
        this.spawnImpactParticles(enemy.body.x, enemy.body.y, killed ? 0xffd166 : 0xff8a66, killed ? 14 : 7, killed ? 220 : 150);
        this.playJuiceSound(killed ? 'kill' : 'hit');
        this.triggerHitStop(killed ? 80 : 45);
        this.updateEnemyHealthBar(enemy);

        const popup = this.add.text(enemy.body.x, enemy.body.y - 52, `-${damage}`, {
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
            enemy.details.destroy();
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
            shape: this.add.circle(this.player.x, this.player.y, this.playerStats.stats.bulletRadius, 0xffe066),
            velocityX: Math.cos(angle) * BULLET_SPEED,
            velocityY: Math.sin(angle) * BULLET_SPEED,
            owner: 'player',
            damage: this.playerStats.stats.damage
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
                    this.damageEnemy(hitEnemy, bullet.damage);
                    bullet.shape.destroy();
                    this.bullets.splice(i, 1);
                }
                continue;
            }

            const playerBounds = this.player.getBounds();
            const hitPlayer = playerBounds.contains(bullet.shape.x, bullet.shape.y);
            if (outOfBounds || hitPlatform || hitPlayer) {
                if (hitPlayer) {
                    this.playerHealth = Math.max(0, this.playerHealth - bullet.damage * (1 - this.playerStats.stats.damageReduction));
                    this.player.setFillStyle(0xff6666);
                    this.playPlayerDamageFeedback();
                    this.time.delayedCall(120, () => this.player.setFillStyle(PLAYER_COLORS[this.lifeStage]));
                    this.checkPlayerDefeat();
                }
                bullet.shape.destroy();
                this.bullets.splice(i, 1);
            }
        }
    }
}
