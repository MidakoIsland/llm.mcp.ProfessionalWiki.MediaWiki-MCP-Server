import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { makeRestGetRequest, ensureWiki } from '../common/utils.js';
import type { MwRestApiPageObject } from '../types/mwRestApi.js';
import { ContentFormat, getSubEndpoint } from '../common/mwRestApiContentFormat.js';

export function getPagesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-pages',
		'Returns one or more wiki pages. Use metadata=true to retrieve the revision ID required by update-pages. Set content="none" to fetch only metadata without content.',
		{
			pages: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				title: z.string().describe( 'Wiki page title' ),
				content: z.nativeEnum( ContentFormat ).optional().default( ContentFormat.source ).describe( 'Type of content to return' ),
				metadata: z.boolean().optional().default( false ).describe( 'Whether to include metadata (page ID, revision info, license) in the response' )
			} ) ).describe( 'List of one or more pages to get' )
		},
		{
			title: 'Get pages',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { pages } ) => handleGetPagesTool( pages )
	);
}

async function handleGetPagesTool(
	pages: { wikiSite: string; title: string; content: ContentFormat; metadata: boolean }[]
): Promise<CallToolResult> {
	const results: TextContent[] = [];
	let hasError = false;

	for ( const page of pages ) {
		if ( page.content === ContentFormat.none && !page.metadata ) {
			hasError = true;
			results.push( {
				type: 'text',
				text: `[${ page.wikiSite }] Error for page "${ page.title }": When content is set to "none", metadata must be true`
			} );
			continue;
		}

		try {
			ensureWiki( page.wikiSite );
			const data = await makeRestGetRequest<MwRestApiPageObject>(
				`/v1/page/${ encodeURIComponent( page.title ) }${ getSubEndpoint( page.content ) }`
			);
			
			const pageResults = getPageToolResult( data, page.content, page.metadata );
			for ( const res of pageResults ) {
				results.push( {
					type: 'text',
					text: `[${ page.wikiSite }] Page: ${ page.title }\n${ res.text }`
				} );
			}
		} catch ( error ) {
			hasError = true;
			results.push( {
				type: 'text',
				text: `[${ page.wikiSite }] Failed to retrieve page data for "${ page.title }": ${ ( error as Error ).message }`
			} );
		}
	}

	return {
		content: results,
		isError: hasError
	};
}

function getPageToolResult(
	result: MwRestApiPageObject, content: ContentFormat, metadata: boolean
): TextContent[] {
	if ( content === ContentFormat.source && !metadata ) {
		return [ {
			type: 'text',
			text: result.source ?? 'Not available'
		} ];
	}

	if ( content === ContentFormat.html && !metadata ) {
		return [ {
			type: 'text',
			text: result.html ?? 'Not available'
		} ];
	}

	const results: TextContent[] = [ getPageMetadataTextContent( result ) ];

	if ( result.source !== undefined ) {
		results.push( {
			type: 'text',
			text: `Source:\n${ result.source }`
		} );
	}

	if ( result.html !== undefined ) {
		results.push( {
			type: 'text',
			text: `HTML:\n${ result.html }`
		} );
	}

	return results;
}

function getPageMetadataTextContent( result: MwRestApiPageObject ): TextContent {
	return {
		type: 'text',
		text: [
			`Page ID: ${ result.id }`,
			`Title: ${ result.title }`,
			`Latest revision ID: ${ result.latest.id }`,
			`Latest revision timestamp: ${ result.latest.timestamp }`,
			`Content model: ${ result.content_model }`,
			`License: ${ result.license.url } ${ result.license.title }`,
			`HTML URL: ${ result.html_url ?? 'Not available' }`
		].join( '\n' )
	};
}
