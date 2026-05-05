// سرقة جماعية — heist تحتاج 3+ لاعبين
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fmt, getUser, saveUser, brandedEmbed, errorEmbed, balanceFooter, safeReply, CURRENCY } = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

const ENTRY = 500;

module.exports = {
  aliases: ['سرقة_جماعية','heist'],
  data: new SlashCommandBuilder().setName('heist').setDescription('💰 سرقة جماعية للبنك')
    .addIntegerOption(o => o.setName('entry').setDescription('رسوم المشاركة').setMinValue(100).setMaxValue(10000)),

  async execute(interaction) {
    const entry = interaction.options.getInteger('entry') || ENTRY;
    const userId = interaction.user.id, guildId = interaction.guild.id;
    const { g, u } = getUser(guildId, userId);
    if (u.balance < entry) return safeReply(interaction, { embeds:[errorEmbed('رصيد غير كافٍ', `${fmt(entry)} ${CURRENCY}`)], ephemeral:true });
    u.balance -= entry; saveUser(guildId, g);
    const players = new Map(); players.set(userId, true);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hs_join').setLabel('🎭 انضم').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('hs_start').setLabel('🚨 ابدأ السرقة').setStyle(ButtonStyle.Danger)
    );
    const embed = () => brandedEmbed(interaction,'💰 سرقة بنك', COLORS.warning).setDescription(
      `🦹 المشاركون (${players.size}):\n${[...players.keys()].map(p=>`<@${p}>`).join(' • ')}\n\n` +
      `💵 رسوم: **${fmt(entry)}** ${CURRENCY}\n💰 الجائزة: **${fmt(entry * players.size * 3)}** ${CURRENCY}\n` +
      `🎯 نسبة النجاح: **${Math.min(95, 30 + players.size*15)}%**\n\nتحتاج 3+ لاعبين على الأقل. ⏱️ 60 ثانية للتجمع.`
    );
    const msg = await safeReply(interaction, { embeds:[embed()], components:[row] });
    const col = msg.createMessageComponentCollector({ time: 60000 });
    col.on('collect', async i => {
      if (i.customId === 'hs_join') {
        if (players.has(i.user.id)) return i.reply({ content:'مشارك بالفعل.', ephemeral:true });
        const r = getUser(guildId, i.user.id);
        if (r.u.balance < entry) return i.reply({ content:'رصيدك لا يكفي.', ephemeral:true });
        r.u.balance -= entry; saveUser(guildId, r.g);
        players.set(i.user.id, true);
        return i.update({ embeds:[embed()], components:[row] });
      }
      if (i.customId === 'hs_start') {
        if (i.user.id !== userId) return i.reply({ content:'فقط المنظم يبدأ.', ephemeral:true });
        if (players.size < 3) return i.reply({ content:'تحتاج 3+ لاعبين.', ephemeral:true });
        col.stop('go');
        await i.deferUpdate();
      }
    });
    col.on('end', async (_c, reason) => {
      if (players.size < 3) {
        // refund
        for (const pid of players.keys()) { const r = getUser(guildId, pid); r.u.balance += entry; saveUser(guildId, r.g); }
        return interaction.editReply({ embeds:[brandedEmbed(interaction,'❌ ألغيت', COLORS.error).setDescription('لم يتجمع لاعبين كافين. تم إرجاع الرسوم.')], components:[] }).catch(()=>{});
      }
      const successRate = Math.min(0.95, 0.30 + players.size * 0.15);
      const success = Math.random() < successRate;
      const pool = entry * players.size * 3;
      if (success) {
        const share = Math.floor(pool / players.size);
        for (const pid of players.keys()) { const r = getUser(guildId, pid); r.u.balance += share; saveUser(guildId, r.g); }
        return interaction.editReply({ embeds:[brandedEmbed(interaction,'🎉 نجحت السرقة!', COLORS.success).setDescription(`💰 لكل مشارك: **${fmt(share)}** ${CURRENCY}\n👥 الفريق: ${[...players.keys()].map(p=>`<@${p}>`).join(' • ')}`)], components:[] }).catch(()=>{});
      } else {
        return interaction.editReply({ embeds:[brandedEmbed(interaction,'🚔 فشلت!', COLORS.error).setDescription('قُبض عليكم! خسرتم رسوم الدخول.')], components:[] }).catch(()=>{});
      }
    });
  }
};
