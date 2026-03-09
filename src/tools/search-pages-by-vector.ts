import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { wikiService } from '../common/wikiService.js';
import { ensureWiki } from '../common/utils.js';
import { getMwn } from '../common/mwn.js';

export function searchPagesByVectorTool(server: McpServer): RegisteredTool {
    return server.tool(
        'search-pages-by-vector',
        'Performs semantic searches against one or more target wikis using the LlamaIndex vector store. Returns best-matching page snippets along with their relevance scores and page metadata. Best used for conceptual queries or aggregating information across multiple pages. Can be used for searching among multiple wikis. `update-vector-indices` can be invoked for updating outdated vector indices.',
        {
            searches: z.array(z.object({
                wikiSite: z.string().describe('The name of the wiki site to interact with (e.g. en.wikipedia.org)'),
                query: z.string().describe('Semantic search query string'),
                numSnippets: z.number().int().min(1).max(100).optional().describe('Number of snippets to return (default 5, max 100)'),
                snippetLength: z.number().int().min(10).max(1000).optional().describe('Maximum text length of each snippet (default 100, max 1000)')
            })).describe('List of one or more semantic searches to perform')
        },
        {
            title: 'Search Pages (Vector Semantic Search)',
            readOnlyHint: true,
            destructiveHint: false
        } as ToolAnnotations,
        async ({ searches }) => handleSearchPagesByVectorTool(searches)
    );
}

// Helper to split array into smaller chunks
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

interface PageData {
    pageid?: number;
    ns?: number;
    title: string;
    lastrevid?: number;
    fullurl?: string;
    missing?: boolean;
    invalid?: boolean;
}

async function handleSearchPagesByVectorTool(
    searches: { wikiSite: string; query: string; numSnippets?: number; snippetLength?: number }[]
): Promise<CallToolResult> {
    const finalResults: TextContent[] = [];
    let hasError = false;

    for (const search of searches) {
        try {
            ensureWiki(search.wikiSite);
            const vectorConfig = wikiService.getVectorServerConfig(search.wikiSite);

            // Shio: Use wikiSite as the implicit wikiId for the LlamaIndex service.
            const wikiId = search.wikiSite;

            // Ensure the URL is correctly formatted for search
            const searchEndpoint = vectorConfig.serverUrl.endsWith('/search')
                ? vectorConfig.serverUrl
                : `${vectorConfig.serverUrl.replace(/\/$/, '')}/search`;

            let searchUrl = `${searchEndpoint}?q=${encodeURIComponent(search.query)}&wiki_id=${encodeURIComponent(wikiId)}`;

            if (search.numSnippets !== undefined) {
                searchUrl += `&limit=${encodeURIComponent(search.numSnippets.toString())}`;
            }
            if (search.snippetLength !== undefined) {
                searchUrl += `&snippet_length=${encodeURIComponent(search.snippetLength.toString())}`;
            }

            const headers: Record<string, string> = {};
            if (vectorConfig.apiKey) {
                headers['X-API-Key'] = vectorConfig.apiKey;
            }

            const response = await fetch(searchUrl, { headers });

            if (!response.ok) {
                throw new Error(`Vector service responded with status: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            let results = data.results || [];

            if (results.length > 0) {
                // Shio: Verify wiki permissions and fetch metadata.
                const mwn = await getMwn();
                const uniqueTitles = [...new Set<string>(results.map((r: any) => r.metadata?.title).filter(Boolean))];

                if (uniqueTitles.length > 0) {
                    const titleChunks = chunkArray(uniqueTitles, 50);
                    const pageDataMap = new Map<string, PageData>();

                    for (const chunk of titleChunks) {
                        const verifyData = await mwn.request({
                            action: 'query',
                            prop: 'info',
                            inprop: 'url',
                            titles: chunk.join('|')
                        });

                        const pages = verifyData.query?.pages || [];
                        for (const p of pages) {
                            pageDataMap.set(p.title, p as PageData);
                        }
                    }

                    results = results.filter((r: any) => {
                        const pd = pageDataMap.get(r.metadata?.title);
                        return pd && !pd.missing && !pd.invalid;
                    });

                    for (const r of results) {
                        r._mwData = pageDataMap.get(r.metadata?.title);
                    }
                }
            }

            if (results.length === 0) {
                finalResults.push({
                    type: 'text',
                    text: `[${search.wikiSite}] No semantic matches found for "${search.query}"`
                });
            } else {
                finalResults.push({
                    type: 'text',
                    text: `[${search.wikiSite}] Semantic matches for "${search.query}":\n` +
                        results.map((r: any) => getVectorSearchResultToolResult(search.wikiSite, r)).map((t: TextContent) => t.text).join('\n\n')
                });
            }
        } catch (error) {
            hasError = true;
            finalResults.push({
                type: 'text',
                text: `[${search.wikiSite}] Failed to query vector store for "${search.query}": ${(error as Error).message}`
            });
        }
    }

    return {
        content: finalResults,
        isError: hasError
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getVectorSearchResultToolResult(wikiSite: string, result: any): TextContent {
    const metadataTitle = result.metadata?.title || 'Unknown';
    const mwData: PageData | undefined = result._mwData;
    
    // Fallback URL generation if mwData is somehow missing
    const { server, articlepath, scriptpath } = wikiService.getCurrent().config;
    const isRestUrl = articlepath === undefined;
    const fallbackUrl = isRestUrl ? `${server}${scriptpath}/index.php?title=${encodeURIComponent(metadataTitle)}` : `${server}${articlepath}/${encodeURIComponent(metadataTitle)}`;

    const pageUrl = mwData?.fullurl || fallbackUrl;
    const indexedRev = result.metadata?.rev_id ? Number(result.metadata.rev_id) : undefined;
    const latestRev = mwData?.lastrevid;
    
    let statusStr = "Unknown";
    if (indexedRev !== undefined && latestRev !== undefined) {
        statusStr = (indexedRev === latestRev) ? "Up-to-date" : "Outdated (Needs re-indexing)";
    }

    return {
        type: 'text',
        text: [
            `Score: ${(result.score).toFixed(4)}`,
            `Title: ${metadataTitle}`,
            `Namespace: ${mwData?.ns ?? 'Unknown'}`,
            `Page ID: ${mwData?.pageid ?? 'Unknown'}`,
            `Indexed Revision: ${indexedRev ?? 'Unknown'}`,
            `Latest Revision: ${latestRev ?? 'Unknown'}`,
            `Vector Status: ${statusStr}`,
            `Page URL: ${pageUrl}`,
            `Snippet: ${result.text}`
        ].join('\n')
    };
}
