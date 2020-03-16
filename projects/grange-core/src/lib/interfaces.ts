import { HttpErrorResponse } from '@angular/common/http';

export interface AuthenticatedStatus {
    state: boolean;
    pending: boolean;
    username: string | null;
    error?: string;
}

export interface LoginInfo {
    login: string;
    password: string;
    token: string;
}

export interface RecoverInfo {
  login: string;
}

export interface ContainerInfo {
  register: boolean;
  social: string[];
}


export interface PasswordResetInfo {
    oldPassword?: string;
    newPassword: string;
    login: string;
    token?: string;
}

export interface UserInfoTokenParts {
    username?: string;
    sub?: string;
    exp?: number;
    fullname?: string;
    id?: string;
}

export interface LoginToken {
    token: string;
}

export interface Error {
    type: string;  // mostly, Python exception class
    message: string;
    traceback?: string[];  // Plone traceback

    errors?: {  // mostly, dexterity fields validation errors
        field?: string;
        message?: string;
        error?: string;
        [x: string]: any;
    }[];

    response?: HttpErrorResponse;

    [x: string]: any;
}

export interface LoadingStatus {
    loading?: boolean;
    error?: Error;
}

export interface NavLink {
    '@id': string;
    title: string;
    url: string;
    path: string;
    active: boolean;
    properties?: any;
}

export interface NamedFileUpload {
    data: any;
    encoding: string;
    filename: string;
    'content-type': string;
}


export interface WorkflowHistoryItem<S extends string = string, T extends string = string> {
    action: T | null;
    actor: string;
    comments: string;
    review_state: S;
    time: string;
    title: string;
}

export interface WorkflowTransitionItem {
    '@id': string;
    title: string;
}

export interface WorkflowInformation<S extends string = string, T extends string = string> {
    '@id': string;
    history: WorkflowHistoryItem<S, T>[];
    transitions: WorkflowTransitionItem[];
}

export interface WorkflowTransitionOptions {
    comment?: string;

    [x: string]: any;
}

export interface SearchOptions {
    sort_on?: string;
    sort_order?: string;
    metadata_fields?: string[];
    start?: number;
    size?: number;
    fullobjects?: boolean;
}

export interface Batching {
    '@id': string;
    first: string;
    last: string;
    next: string;
    prev: string;
}

export interface SearchResults {
    '@id': string;
    items_total: number;
    items: BaseItem[];
    batching: Batching;
}

export interface Resource {
    '@id': string;
    '@name': string;
    '@type': string;
    '@uid': string;
    title: string;
    description?: string;
    is_folderish: boolean;
    parent: BaseItem;
}

export interface GrangeType {
    '@id': string;
    addable: boolean;
    title: string;
}

export interface GrangeAction {
    icon: string;
    id: string;
    title: string;
}

export interface BaseItem {
    '@id': string;
    '@type': string;
    description: string;
    review_state: string;
    title: string;
}

export interface Role {
    '@id': string;
    '@type': string;
    id: string;
    title: string;
}
export interface GrangeFile {
    'content-type': string;
    data?: string;
    encoding?: string;
    download?: string;
    filename: string;
    size?: number;
}

export interface GrangeImage extends GrangeFile {
    height?: number;
    width?: number;
}