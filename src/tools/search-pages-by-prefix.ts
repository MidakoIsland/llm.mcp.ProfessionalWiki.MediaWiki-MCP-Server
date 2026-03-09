import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ApiQueryAllPagesParams } from 'types-mediawiki-api';
/* eslint-enable n/no-missing-import */
import { processBatchOperations } from '../common/utils.js';
import { getMwn } from '../common/mwn.js';

export function searchPagesByPrefixTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'search-pages-by-prefix',
		'Performs prefix searches for page titles across one or more wikis.',
		{
			searches: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				prefix: z.string().describe( 'Search prefix' ),
				limit: z.number().int().min( 1 ).max( 500 ).optional().describe( 'Maximum number of results to return' ),
				namespace: z.number().int().nonnegative().optional().describe( 'Namespace to search' )
			} ) ).describe( 'List of one or more prefix searches to perform' )
		},
		{
			title: 'Search pages by prefix',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { searches } ) => handleSearchPagesByPrefixTool( searches )
	);
}

async function handleSearchPagesByPrefixTool(
	searches: { wikiSite: string; prefix: string; limit?: number; namespace?: number }[]
): Promise<CallToolResult> {
	return processBatchOperations(
		searches,
		( search ) => search.wikiSite,
		async ( search ) => {
			const mwn = await getMwn( search.wikiSite );
			const options: ApiQueryAllPagesParams = {};

			if ( search.limit ) {
				options.aplimit = search.limit;
			}
			if ( search.namespace !== undefined ) {
				options.apnamespace = search.namespace;
			}

			const data = await mwn.getPagesByPrefix( search.prefix, options );

			if ( data.length === 0 ) {
				return [ {
					type: 'text' as const,
					text: `[${ search.wikiSite }] No pages found with the prefix "${ search.prefix }"`
				} ];
			} else {
				return [ {
					type: 'text' as const,
					text: `[${ search.wikiSite }] Prefix matches for "${ search.prefix }":\n` + 
						data.join( '\n' )
				} ];
			}
		}
	);
}
