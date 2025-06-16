declare module 'openai' {
  interface ClientOptions {
    apiKey: string
    baseURL?: string
    dangerouslyAllowBrowser?: boolean
  }

  interface ChatCompletion {
    choices: Array<{
      delta?: {
        content?: string
        role?: string
      }
      message?: {
        role: string
        content: string
      }
    }>
    [Symbol.asyncIterator](): AsyncIterableIterator<ChatCompletion>
  }

  interface ChatCompletionCreateParams {
    model: string
    messages: Array<{role: string, content: string}>
    temperature?: number
    max_tokens?: number
    stream?: boolean
  }

  interface ChatCompletionCreateParamsStreaming extends ChatCompletionCreateParams {
    stream: true
  }

  class OpenAI {
    constructor(options: ClientOptions)
    chat: {
      completions: {
    create(options: ChatCompletionCreateParams): Promise<ChatCompletion>
    create(options: ChatCompletionCreateParamsStreaming): AsyncIterable<ChatCompletion>
      }
    }
  }

  export = OpenAI
}
