/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
/* eslint-enable n/no-missing-import */

import { getPagesTool } from './get-pages.js';
import { getPageHistoriesTool } from './get-page-histories.js';
import { searchPageTool } from './search-page.js';
import { setWikiTool } from './set-wiki.js';
import { addWikiTool } from './add-wiki.js';
import { removeWikiTool } from './remove-wiki.js';
import { updatePagesTool } from './update-pages.js';
import { getFileTool } from './get-file.js';
import { createPagesTool } from './create-pages.js';
import { uploadFileTool } from './upload-file.js';
import { uploadFileFromUrlTool } from './upload-file-from-url.js';
import { deletePagesTool } from './delete-pages.js';
import { getRevisionsTool } from './get-revisions.js';
import { undeletePagesTool } from './undelete-pages.js';
import { getCategoryMembersTool } from './get-category-members.js';
import { searchPageByPrefixTool } from './search-page-by-prefix.js';
import { searchPageByVectorTool } from './search-page-by-vector.js';
import { getNamespacesTool } from './get-namespaces.js';
import { createNamespaceTool } from './create-namespace.js';
import { updateWikiTool } from './update-wiki.js';
import { getCategoriesTool } from './get-categories.js';
import { movePagesTool } from './move-pages.js';
import { uploadFileFromStreamTool } from './upload-file-from-stream.js';
import { updateVectorIndicesTool } from './update-vector-indices.js';

const toolRegistrars = [
	getPagesTool,
	getPageHistoriesTool,
	searchPageTool,
	setWikiTool,
	addWikiTool,
	removeWikiTool,
	updatePagesTool,
	getFileTool,
	createPagesTool,
	uploadFileTool,
	uploadFileFromUrlTool,
	deletePagesTool,
	getRevisionsTool,
	undeletePagesTool,
	getCategoryMembersTool,
	searchPageByPrefixTool,
	searchPageByVectorTool,
	getNamespacesTool,
	createNamespaceTool,
	updateWikiTool,
	getCategoriesTool,
	movePagesTool,
	uploadFileFromStreamTool,
	updateVectorIndicesTool
];

export function registerAllTools( server: McpServer ): RegisteredTool[] {
	const registeredTools: RegisteredTool[] = [];
	for ( const registrar of toolRegistrars ) {
		try {
			registeredTools.push( registrar( server ) );
		} catch ( error ) {
			console.error( `Error registering tool: ${ ( error as Error ).message }` );
		}
	}
	return registeredTools;
}
