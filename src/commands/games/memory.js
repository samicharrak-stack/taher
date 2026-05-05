const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const {
  fmt, getUser, saveUser, bumpStat,
  brandedEmbed, gifEmbed, winEmbed, loseEmbed, tieEmbed,
  balanceFooter, safeReply, CURRENCY
} = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

const POOL = ['🦁','🐯','🦒','🦊','🐻','🐨','🐼','🐹','🐰','🐭','🐸','🐧','🦆','🦉','🦇','🐺','🐮','🐷'];
const PAIRS = 8; // 4x4 grid

module.exports = {
  aliases: ['ذاكرة', 'memory'],
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('🧠 لعبة الذاكرة — اعثر على جميع الأزواج'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const picks = POOL.slice().sort(() => Math.random() - 0.5).slice(0, PAIRS);
    const board = [...picks, ...picks].sort(() => Math.random() - 0.5);
    const revealed = Array(16).fill(false);
    const matched  = Array(16).fill(false);
    let selection = [];
    let moves = 0, found = 0;
    const start = Date.now();

    const renderRows = (lockAll = false) => {
      const rows = [];
      for (let r = 0; r < 4; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 4; c++) {
          const idx = r * 4 + c;
          const isOpen = revealed[idx] || matched[idx];
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`mem_${idx}`)
              .setLabel(isOpen ? '\u200b' : '❔')
              .setEmoji(isOpen ? board[idx] : null)
              .setStyle(matched[idx] ? ButtonStyle.Success : isOpen ? ButtonStyle.Primary : ButtonStyle.Secondary)
              .setDisabled(lockAll || matched[idx] || selection.includes(idx))
          );
        }
        rows.push(row);
      }
      return rows;
    };

    const renderEmbed = (status = '') => gifEmbed(interaction, '🧠 لعبة الذاكرة', '', 'memory', 'play', COLORS.primary)
      .setDescription(
        `🎯 الأزواج: **${found}/${PAIRS}**\n` +
        `🎯 الحركات: **${moves}**\n` +
        (status ? `\n${status}` : '\nاضغط على بطاقتين للبحث عن المطابقة.')
      );

    const msg = await safeReply(interaction, { embeds: [renderEmbed()], components: renderRows() });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000,
      filter: i => i.user.id === userId && i.customId.startsWith('mem_')
    });

    collector.on('collect', async i => {
      const idx = parseInt(i.customId.split('_')[1], 10);
      if (matched[idx] || selection.includes(idx) || selection.length >= 2) return i.deferUpdate();

      selection.push(idx);
      revealed[idx] = true;

      if (selection.length < 2) {
        return i.update({ embeds: [renderEmbed()], components: renderRows() });
      }

      moves++;
      const [a, b] = selection;
      if (board[a] === board[b]) {
        matched[a] = matched[b] = true;
        found++;
        selection = [];
        if (found === PAIRS) {
          collector.stop('win');
          return i.update({ embeds: [renderEmbed('✨ مطابقة!')], components: renderRows() });
        }
        return i.update({ embeds: [renderEmbed('✅ مطابقة!')], components: renderRows() });
      }

      // No match — flash, then hide
      await i.update({ embeds: [renderEmbed('❌ لا تطابق...')], components: renderRows(true) });
      setTimeout(async () => {
        revealed[a] = revealed[b] = false;
        selection = [];
        await interaction.editReply({ embeds: [renderEmbed()], components: renderRows() }).catch(()=>{});
      }, 1200);
    });

    collector.on('end', async (_c, reason) => {
      const { g, u } = getUser(guildId, userId);
      bumpStat(u, 'memory_count');
      const seconds = Math.floor((Date.now() - start) / 1000);
      let final;
      if (reason === 'win') {
        const reward = Math.max(300, 2500 - moves * 80 - seconds * 5);
        u.balance += reward; u.xp += 150;
        bumpStat(u, 'memory_wins');
        final = winEmbed(interaction, 'أنجزت اللعبة!', `🎯 الحركات: **${moves}**\n⏱️ الزمن: **${seconds}s**\n💰 +${fmt(reward)} ${CURRENCY}\n✨ +150 XP`, 'memory');
      } else {
        final = tieEmbed(interaction, 'انتهى الوقت', `أزواج مكتشفة: **${found}/${PAIRS}**`, 'memory');
      }
      saveUser(guildId, g);
      final.setFooter(balanceFooter(u));
      await interaction.editReply({ embeds: [final], components: [] }).catch(()=>{});
    });
  }
};
