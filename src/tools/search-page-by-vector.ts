import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { wikiService } from '../common/wikiService.js';
import { ensureWiki } from '../common/utils.js';
import { getMwn } from '../common/mwn.js';

export function searchPageByVectorTool(server: McpServer): RegisteredTool {
    return server.tool(
        'search-page-by-vector',
        'Performs a semantic search against a target wiki using the LlamaIndex vector store. Returns up to 5 best-matching page snippets along with their relevance scores and page metadata. Best used for conceptual queries or aggregating information across multiple pages.',
        {
            wikiSite: z.string().describe('The name of the wiki site to interact with (e.g. en.wikipedia.org)'),
            query: z.string().describe('Semantic search query string'),
            wikiId: z.string().describe('The wiki_id used by the vector service to route the request (e.g. usagiwiki)')
        },
        {
            title: 'Search Page (Vector Semantic Search)',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ({ wikiSite, query, wikiId }) => handleSearchPageByVectorTool(wikiSite, query, wikiId)
    );
}

async function handleSearchPageByVectorTool(wikiSite: string, query: string, wikiId: string): Promise<CallToolResult> {
    ensureWiki(wikiSite);

    try {
        const config = wikiService.getCurrent().config;
        const vectorUrl = config.vectorUrl;

        if (!vectorUrl) {
            return {
                content: [
                    { type: 'text', text: `Configuration error: No 'vectorUrl' defined for wiki '${wikiSite}'. Example: http://127.0.0.1:5000/search` } as TextContent
                ],
                isError: true
            };
        }

        // Ensure the URL is correctly formatted for search
        // The vector service expects /search endpoint
        const searchEndpoint = vectorUrl.endsWith('/search')
            ? vectorUrl
            : `${vectorUrl.replace(/\/$/, '')}/search`;

        const searchUrl = `${searchEndpoint}?q=${encodeURIComponent(query)}&wiki_id=${encodeURIComponent(wikiId)}`;

        const response = await fetch(searchUrl);

        if (!response.ok) {
            throw new Error(`Vector service responded with status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        let results = data.results || [];

        if (results.length > 0) {
            // Shio: Verify wiki permissions. The vector engine bypasses MediaWiki restrictions,
            // so we must cross-reference exactly which titles this authenticated MCP session can read.
            const mwn = await getMwn();
            const uniqueTitles = [...new Set<string>(results.map((r: any) => r.metadata?.title).filter(Boolean))];

            if (uniqueTitles.length > 0) {
                const verifyData = await mwn.request({
                    action: 'query',
                    titles: uniqueTitles.join('|')
                });

                // MediaWiki 'query' returns pages either with a valid pageid or marked as 'missing'/'invalid'.
                // If the user lacks read permissions, titles often appear as missing or throw an API error.
                const accessibleTitles = new Set(
                    (verifyData.query?.pages || [])
                        .filter((p: any) => !p.missing && !p.invalid)
                        .map((p: any) => p.title)
                );

                results = results.filter((r: any) => accessibleTitles.has(r.metadata?.title));
            }
        }

        if (results.length === 0) {
            return {
                content: [
                    { type: 'text', text: `No semantic matches found for "${query}"` } as TextContent
                ]
            };
        }

        return {
            content: results.map(getVectorSearchResultToolResult)
        };
    } catch (error) {
        return {
            content: [
                { type: 'text', text: `Failed to query vector store: ${(error as Error).message}` } as TextContent
            ],
            isError: true
        };
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getVectorSearchResultToolResult(result: any): TextContent {
    const { server, articlepath, scriptpath } = wikiService.getCurrent().config;

    // Try to reconstruct the URL based on metadata title
    const metadataTitle = result.metadata?.title || 'Unknown';
    const isRestUrl = articlepath === undefined; // fallback mechanism
    const pageUrl = isRestUrl ? `${server}${scriptpath}/index.php?title=${encodeURIComponent(metadataTitle)}` : `${server}${articlepath}/${encodeURIComponent(metadataTitle)}`;

    return {
        type: 'text',
        text: [
            `Score: ${(result.score).toFixed(4)}`,
            `Title: ${metadataTitle}`,
            `Snippet: ${result.text}`,
            `Page URL: ${pageUrl}`
        ].join('\n')
    };
}
