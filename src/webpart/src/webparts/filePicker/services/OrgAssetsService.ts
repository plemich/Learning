import { FileBrowserService } from "./FileBrowserService";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { SPHttpClient } from "@microsoft/sp-http";
import { ILibrary, FilesQueryResult } from "./FileBrowserService.types";
import { ExtensionContext } from "@microsoft/sp-extension-base";

export class OrgAssetsService extends FileBrowserService {
  private _orgAssetsLibraryServerRelativeSiteUrl: string = null;

  constructor(context: ExtensionContext | WebPartContext, itemsToDownloadCount?: number) {
    super(context, itemsToDownloadCount);
  }

  public getListItems = async (libraryName: string, folderPath: string, acceptedFilesExtensions?: string[], nextPageQueryStringParams?: string): Promise<FilesQueryResult> => {
    let filesQueryResult: FilesQueryResult = { items: [], nextHref: null };
    try {
      // Retrieve Lib path from folder path
      if (folderPath.charAt(0) !== "/") {
        folderPath = `/${folderPath}`;
      }
      // Remove all the rest of the folder path
      let libName = folderPath.replace(`${this._orgAssetsLibraryServerRelativeSiteUrl}/`, "");
      libName = libName.split("/")[0];
      // Buil absolute library URL
      const libFullUrl = this.buildAbsoluteUrl(`${this._orgAssetsLibraryServerRelativeSiteUrl}/${libName}`);

      let queryStringParams: string = "";
      // Do not pass FolderServerRelativeUrl as query parameter
      // Attach passed nextPageQueryStringParams values to REST URL
      if (nextPageQueryStringParams) {
        // Remove start ? from the query params
        if (nextPageQueryStringParams.charAt(0) === "?") {
          nextPageQueryStringParams = nextPageQueryStringParams.substring(1);
        }
        queryStringParams = nextPageQueryStringParams;
      } else {
        queryStringParams = `RootFolder=${folderPath}`;
      }
      const restApi = `${this.context.pageContext.web.absoluteUrl}/_api/SP.List.GetListDataAsStream?listFullUrl='${libFullUrl}'&${queryStringParams}`;

      filesQueryResult = await this._getListDataAsStream(restApi, null, acceptedFilesExtensions);
    } catch (error) {
      filesQueryResult.items = null;
      console.error(error.message);
    }
    return filesQueryResult;
  }

  public getSiteMediaLibraries = async (includePageLibraries: boolean = false): Promise<ILibrary[]> => {
    try {
      const restApi = `${this.context.pageContext.web.absoluteUrl}/_api/Microsoft.Online.SharePoint.TenantManagement.Office365Tenant/GetOrgAssets`;
      const orgAssetsResult = await this.context.spHttpClient.get(restApi, SPHttpClient.configurations.v1);

      if (!orgAssetsResult || !orgAssetsResult.ok) {
        throw new Error(`Something went wrong when executing request. Status='${orgAssetsResult.status}'`);
      }
      const orgAssetsData = await orgAssetsResult.json();
      if (!orgAssetsData || !orgAssetsData.OrgAssetsLibraries || !orgAssetsData.OrgAssetsLibraries.Items || orgAssetsData.OrgAssetsLibraries.Items.length <= 0) {
        return null;
      }

      this._orgAssetsLibraryServerRelativeSiteUrl = orgAssetsData ? orgAssetsData.Url.DecodedUrl : null;
      const libs: ILibrary[] = orgAssetsData ? orgAssetsData.OrgAssetsLibraries.Items.map((libItem) => { return this._parseOrgAssetsLibraryItem(libItem); }) : [];
      return libs;
    } catch (error) {
      console.error(`[OrgAssetsService.getOrganisationAssetsLibraries]: Err='${error.message}'`);
      return null;
    }
  }

  private _parseOrgAssetsLibraryItem = (libItem: any) => {
    const orgAssetsLibrary: ILibrary = {
      absoluteUrl: this.buildAbsoluteUrl(libItem.LibraryUrl.DecodedUrl),
      title: libItem.DisplayName,
      serverRelativeUrl: libItem.LibraryUrl.DecodedUrl,
      iconPath: libItem.ThumbnailUrl.DecodedUrl ? this.buildAbsoluteUrl(`${this._orgAssetsLibraryServerRelativeSiteUrl}/${libItem.ThumbnailUrl.DecodedUrl}`) : null
    };

    return orgAssetsLibrary;
  }
}
