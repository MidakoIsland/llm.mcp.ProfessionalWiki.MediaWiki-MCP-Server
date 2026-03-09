import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { makeRestPostRequest, getPageUrl, formatEditComment, ensureWiki } from '../common/utils.js';
import type { MwRestApiPageObject } from '../types/mwRestApi.js';

export function createPagesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'create-pages',
		'Creates one or more wiki pages with the provided content. IMPORTANT: Before creating a page, you MUST verify the namespace prefix is correct by fetching namespaces first if the target namespace is custom. CRITICAL: DO NOT write any <h1> title (`= ... =`) into the page content! MediaWiki already generates an H1 title from the page name.',
		{
			pages: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				source: z.string().describe( 'Page content in the format specified by the contentModel parameter' ),
				title: z.string().describe( 'Wiki page title including namespace prefix (e.g. "User:John", "MyNamespace:PageTitle")' ),
				comment: z.string().optional().describe( 'Reason for creating the page' ),
				contentModel: z.string().optional().default( 'wikitext' ).describe( 'Type of content on the page' )
			} ) ).describe( 'List of one or more pages to create' )
		},
		{
			title: 'Create pages',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( { pages } ) => handleCreatePagesTool( pages )
	);
}

async function handleCreatePagesTool(
	pages: { wikiSite: string; source: string; title: string; comment?: string; contentModel?: string }[]
): Promise<CallToolResult> {
	const results: TextContent[] = [];
	let hasError = false;

	for ( const page of pages ) {
		try {
			ensureWiki( page.wikiSite );
			const data = await makeRestPostRequest<MwRestApiPageObject>( '/v1/page', {
				source: page.source,
				title: page.title,
				comment: formatEditComment( 'create-pages', page.comment ),
				// eslint-disable-next-line camelcase
				content_model: page.contentModel
			}, true );

			results.push( {
				type: 'text',
				text: `[${ page.wikiSite }] Page created successfully: ${ getPageUrl( data.title ) }\nPage ID: ${ data.id }\nLatest revision ID: ${ data.latest.id }`
			} );
		} catch ( error ) {
			hasError = true;
			results.push( {
				type: 'text',
				text: `[${ page.wikiSite }] Failed to create page "${ page.title }": ${ ( error as Error ).message }`
			} );
		}
	}

	return {
		content: results,
		isError: hasError
	};
}
