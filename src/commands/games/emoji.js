const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const {
  fmt, getUser, saveUser, bumpStat,
  brandedEmbed, gifEmbed, winEmbed, loseEmbed, tieEmbed,
  balanceFooter, safeReply, CURRENCY
} = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

const SETS = [
  { theme: 'وجبات سريعة', items: ['🍔','🍟','🍕','🥤','🌮','🌭','🥪','🍿'] },
  { theme: 'سيارات',       items: ['🚗','🚕','🚓','🚑','🚒','🚐','🚙','🚌'] },
  { theme: 'فواكه',        items: ['🍎','🍌','🍇','🍓','🍑','🥭','🍍','🍒'] },
  { theme: 'رياضة',        items: ['⚽','🏀','🏈','🎾','🏐','🏉','⚾','🥎'] },
  { theme: 'حيوانات',      items: ['🐱','🐶','🐭','🐹','🐰','🦊','🐻','🐼'] },
  { theme: 'كواكب',        items: ['🌍','🌎','🌏','🌕','🌖','🌗','🌘','🪐'] }
];

module.exports = {
  aliases: ['ايموجي', 'emoji'],
  data: new SlashCommandBuilder()
    .setName('emoji')
    .setDescription('🎮 اعثر على الإيموجي الدخيل بين الإيموجيات المتشابهة')
    .addStringOption(o => o.setName('mode').setDescription('النمط').addChoices(
      { name: '🧐 الدخيل (افتراضي)', value: 'odd' }
    )),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const set = SETS[Math.floor(Math.random() * SETS.length)];
    const correct = set.items[Math.floor(Math.random() * set.items.length)];

    // Build options: 5 same + 1 different
    let intruder;
    do {
      const other = SETS[Math.floor(Math.random() * SETS.length)];
      intruder = other.items[Math.floor(Math.random() * other.items.length)];
    } while (set.items.includes(intruder));

    const options = Array(5).fill(correct).concat(intruder).sort(() => Math.random() - 0.5);

    const embed = gifEmbed(interaction, '🧐 اعثر على الدخيل', '', 'emoji', 'play', COLORS.info)
      .setDescription(`الفئة: **${set.theme}**\n\nأي إيموجي لا ينتمي للفئة؟\n\n${options.map((e, i) => `**${i+1}.** ${e}`).join('   ')}\n\n⏱️ 15 ثانية.`);

    const row = new ActionRowBuilder().addComponents(
      options.map((_, i) => new ButtonBuilder().setCustomId(`em_${i}`).setLabel(`${i+1}`).setStyle(ButtonStyle.Secondary))
    );

    const msg = await safeReply(interaction, { embeds: [embed], components: [row] });
    const col = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: i => i.user.id === userId && i.customId.startsWith('em_'),
      time: 15000, max: 1
    });

    col.on('collect', async i => {
      const idx = parseInt(i.customId.split('_')[1], 10);
      const { g, u } = getUser(guildId, userId);
      bumpStat(u, 'emoji_count');
      let final;
      if (options[idx] === intruder) {
        const reward = 250;
        u.balance += reward; u.xp += 60; bumpStat(u, 'emoji_wins');
        final = winEmbed(interaction, 'إجابة صحيحة!', `الدخيل كان: **${intruder}** عند الموقع **#${options.indexOf(intruder)+1}**\n💰 +${fmt(reward)} ${CURRENCY}`, 'emoji');
      } else {
        final = loseEmbed(interaction, 'إجابة خاطئة', `الدخيل كان: **${intruder}** عند الموقع **#${options.indexOf(intruder)+1}**`, 'emoji');
      }
      saveUser(guildId, g);
      final.setFooter(balanceFooter(u));
      await i.update({ embeds: [final], components: [] });
    });
    col.on('end', c => { if (c.size === 0) interaction.editReply({ embeds: [tieEmbed(interaction, 'انتهى الوقت', `الدخيل كان: **${intruder}**`, 'emoji')], components: [] }).catch(()=>{}); });
  }
};
