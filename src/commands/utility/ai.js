// AI شات — يستخدم Lovable AI Gateway إن كان LOVABLE_API_KEY مضبوطاً
const { SlashCommandBuilder } = require('discord.js');
const { brandedEmbed, errorEmbed, safeReply } = require('../../utils/gameHelpers');
const { COLORS } = require('../../utils/embeds');

const SYSTEM = 'أنت مساعد ذكي ودود في بوت ديسكورد عربي اسمه "سامي". أجب بإيجاز ووضوح بالعربية، ولا تتجاوز 1500 حرف.';

module.exports = {
  aliases: ['ai','اسأل','ask'],
  data: new SlashCommandBuilder().setName('ai').setDescription('🤖 اسأل الذكاء الاصطناعي')
    .addStringOption(o => o.setName('prompt').setDescription('سؤالك').setRequired(true).setMaxLength(1000)),

  async execute(interaction) {
    const key = process.env.LOVABLE_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) return safeReply(interaction, { embeds:[errorEmbed('غير مفعّل', 'أضف `LOVABLE_API_KEY` أو `OPENAI_API_KEY` في متغيرات البيئة لتفعيل الذكاء الاصطناعي.')], ephemeral:true });
    const prompt = interaction.options.getString('prompt');
    await interaction.deferReply();
    try {
      const useLovable = !!process.env.LOVABLE_API_KEY;
      const url = useLovable ? 'https://ai.gateway.lovable.dev/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      const model = useLovable ? 'google/gemini-2.5-flash' : 'gpt-4o-mini';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role:'system', content: SYSTEM },
            { role:'user', content: prompt }
          ]
        })
      });
      if (!res.ok) {
        const t = await res.text();
        return interaction.editReply({ embeds:[errorEmbed('فشل الطلب', `${res.status}: ${t.slice(0,500)}`)] });
      }
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || '⚠️ لا توجد إجابة.';
      await interaction.editReply({ embeds:[brandedEmbed(interaction,'🤖 إجابة الذكاء', COLORS.cyan).setDescription(`**سؤال:** ${prompt}\n\n${reply.slice(0,3500)}`)] });
    } catch (e) {
      await interaction.editReply({ embeds:[errorEmbed('خطأ', e.message)] });
    }
  }
};
