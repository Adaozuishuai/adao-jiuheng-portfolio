import 'server-only';

export type GlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};
export async function requestGlm(
  messages: GlmMessage[],
  options: { stream?: boolean; json?: boolean; signal?: AbortSignal } = {},
) {
  const key = process.env.ZHIPU_API_KEY;
  if (!key) throw new Response('聊天服务尚未配置', { status: 503 });
  const endpoint =
    process.env.AUTH_TEST_ISOLATED === 'true' && process.env.ZHIPU_TEST_API_URL
      ? process.env.ZHIPU_TEST_API_URL
      : 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ZHIPU_MODEL || 'glm-5.3-flash',
        messages,
        stream: !!options.stream,
        ...(options.json
          ? { response_format: { type: 'json_object' } }
          : { max_tokens: 2048 }),
      }),
      signal: options.signal ?? AbortSignal.timeout(30_000),
      cache: 'no-store',
    });
  } catch {
    throw new Response('GLM 调用超时或网络不可用，请重试', { status: 502 });
  }
  if (!response.ok)
    throw new Response(
      response.status === 429
        ? 'GLM 请求过于频繁，请稍后重试'
        : 'GLM 暂时不可用，请稍后重试',
      { status: 502 },
    );
  return response;
}
