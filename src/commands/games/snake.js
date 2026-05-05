const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const {
  fmt, getUser, saveUser, bumpStat,
  brandedEmbed, gifEmbed, winEmbed, loseEmbed, tieEmbed,
  balanceFooter, safeReply, errorEmbed, CURRENCY
} = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

const W = 12, H = 8;
const games = new Map();

const DIFF = {
  easy:   { mult: 1,   obstacles: 0, color: COLORS.success, name: 'سهل' },
  normal: { mult: 1.5, obstacles: 3, color: COLORS.primary, name: 'متوسط' },
  hard:   { mult: 2.5, obstacles: 7, color: COLORS.error,   name: 'صعب' }
};

const SYM = {
  empty: '⬛', body: '🟩', head: '🐍', food: '🍎', gold: '⭐', wall: '🧱'
};

function rand(max) { return Math.floor(Math.random() * max); }

function newGame(diff) {
  const g = {
    snake: [{x:6,y:4},{x:5,y:4}],
    dir: { x: 1, y: 0 },
    food: null, gold: null, walls: [],
    score: 0, gameOver: false, diff
  };
  for (let i = 0; i < DIFF[diff].obstacles; i++) {
    g.walls.push({ x: rand(W), y: rand(H) });
  }
  spawn(g);
  return g;
}

function isOccupied(g, x, y, ignoreSnake = false) {
  if (!ignoreSnake && g.snake.some(s => s.x === x && s.y === y)) return true;
  if (g.walls.some(w => w.x === x && w.y === y)) return true;
  if (g.food && g.food.x === x && g.food.y === y) return true;
  if (g.gold && g.gold.x === x && g.gold.y === y) return true;
  return false;
}

function spawn(g) {
  for (let tries = 0; tries < 200; tries++) {
    const p = { x: rand(W), y: rand(H) };
    if (!isOccupied(g, p.x, p.y)) { g.food = p; break; }
  }
  g.gold = null;
  if (Math.random() < 0.18) {
    for (let tries = 0; tries < 100; tries++) {
      const p = { x: rand(W), y: rand(H) };
      if (!isOccupied(g, p.x, p.y)) { g.gold = p; break; }
    }
  }
}

function step(g) {
  const head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y };
  if (head.x < 0 || head.x >= W || head.y < 0 || head.y >= H) { g.gameOver = true; return; }
  if (g.snake.some(s => s.x === head.x && s.y === head.y)) { g.gameOver = true; return; }
  if (g.walls.some(w => w.x === head.x && w.y === head.y)) { g.gameOver = true; return; }
  g.snake.unshift(head);
  if (g.food && head.x === g.food.x && head.y === g.food.y) { g.score += 1; spawn(g); }
  else if (g.gold && head.x === g.gold.x && head.y === g.gold.y) { g.score += 5; g.gold = null; }
  else g.snake.pop();
}

function render(g) {
  let out = '';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g.snake[0].x === x && g.snake[0].y === y) out += SYM.head;
      else if (g.snake.some(s => s.x === x && s.y === y)) out += SYM.body;
      else if (g.food && g.food.x === x && g.food.y === y) out += SYM.food;
      else if (g.gold && g.gold.x === x && g.gold.y === y) out += SYM.gold;
      else if (g.walls.some(w => w.x === x && w.y === y)) out += SYM.wall;
      else out += SYM.empty;
    }
    out += '\n';
  }
  return out;
}

function gameEmbedFor(interaction, g) {
  return gifEmbed(interaction, '🐍 الدودة', '', 'snake', 'play', DIFF[g.diff].color)
    .setDescription(
      `🍎 النقاط: **${g.score}**  •  🏆 الصعوبة: **${DIFF[g.diff].name}** *(×${DIFF[g.diff].mult})*\n` +
      `⭐ نجمة ذهبية = **+5** نقاط\n\n${render(g)}`
    );
}

function controls() {
  const r1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('snake_x1').setLabel('\u200b').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('snake_w').setLabel('⬆️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('snake_x2').setLabel('\u200b').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('snake_quit').setLabel('🛑 إنهاء').setStyle(ButtonStyle.Danger)
  );
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('snake_a').setLabel('⬅️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('snake_s').setLabel('⬇️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('snake_d').setLabel('➡️').setStyle(ButtonStyle.Primary)
  );
  return [r1, r2];
}

module.exports = {
  aliases: ['دودة', 'ثعبان', 'snake'],
  data: new SlashCommandBuilder()
    .setName('snake')
    .setDescription('🐍 لعبة الدودة — اجمع التفاح وتجنب الجدران')
    .addStringOption(o => o.setName('difficulty').setDescription('الصعوبة').addChoices(
      { name: 'سهل', value: 'easy' },
      { name: 'متوسط', value: 'normal' },
      { name: 'صعب', value: 'hard' }
    )),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const diff = interaction.options.getString('difficulty') || 'normal';
    if (games.has(userId)) {
      return safeReply(interaction, { embeds: [errorEmbed('لعبة جارية', 'لديك لعبة دودة جارية بالفعل.')], ephemeral: true });
    }

    const game = newGame(diff);
    games.set(userId, game);

    const msg = await safeReply(interaction, { embeds: [gameEmbedFor(interaction, game)], components: controls() });
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: i => i.user.id === userId,
      time: 10 * 60 * 1000
    });

    collector.on('collect', async i => {
      if (i.customId === 'snake_quit') { game.gameOver = true; return collector.stop('quit'); }
      const move = i.customId.split('_')[1];
      const dir = move === 'w' ? {x:0,y:-1} : move === 's' ? {x:0,y:1} : move === 'a' ? {x:-1,y:0} : {x:1,y:0};
      if (!(game.snake.length > 1 && dir.x === -game.dir.x && dir.y === -game.dir.y)) {
        game.dir = dir;
      }
      step(game);
      if (game.gameOver) return collector.stop('over');
      await i.update({ embeds: [gameEmbedFor(interaction, game)] }).catch(()=>{});
    });

    collector.on('end', async () => {
      games.delete(userId);
      const { g, u } = getUser(guildId, userId);
      const reward = Math.floor(game.score * 18 * DIFF[diff].mult);
      const xp = Math.floor(game.score * 10 * DIFF[diff].mult);
      u.balance += reward; u.xp += xp;
      bumpStat(u, 'snake_count');
      saveUser(guildId, g);
      const final = (game.score > 0 ? winEmbed : loseEmbed)(interaction, 'انتهت اللعبة',
        `${render(game)}\n🍎 النقاط: **${game.score}**\n💰 +${fmt(reward)} ${CURRENCY} • ✨ +${xp} XP`
      ).setFooter(balanceFooter(u));
      await interaction.editReply({ embeds: [final], components: [] }).catch(()=>{});
    });
  }
};
