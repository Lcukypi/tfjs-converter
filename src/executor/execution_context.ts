/**
 * @license
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
import {Tensor} from '@tensorflow/tfjs-core';

import {NamedTensorsMap} from '../data';

export interface ExecutionContextId {
  id: number;
  frameName: string;
  iterationId: number;
}

/**
 * ExecutionContext captures the runtime environment of the node. It keeps
 * track of the current frame and iteration for the control flow ops.
 */
export class ExecutionContext {
  private rootContext = {id: 0, frameName: '', iterationId: 0};
  private contexts: ExecutionContextId[] = [this.rootContext];
  private lastId = 0;
  private _currentContextIds: string[];

  constructor(public weightMap: NamedTensorsMap) {
    this.generateCurrentContextIds();
  }

  private newFrame(id: number, frameName: string) {
    return {id, frameName, iterationId: 0};
  }

  /**
   * Set the current context
   * @param contexts: ExecutionContextId[] the current path of execution frames
   */
  set currentContext(contexts: ExecutionContextId[]) {
    if (this.contexts !== contexts) {
      this.contexts = contexts;
      this.generateCurrentContextIds();
    }
  }

  get currentContext(): ExecutionContextId[] {
    return this.contexts;
  }

  /**
   * Returns the current context in string format.
   */
  get currentContextId(): string {
    return this._currentContextIds[0];
  }

  /**
   * Returns the current context and all parent contexts in string format.
   * This allow access to the nodes in the current and parent frames.
   */
  get currentContextIds(): string[] {
    return this._currentContextIds;
  }

  private generateCurrentContextIds() {
    const names = [];
    for (let i = 0; i < this.contexts.length - 1; i++) {
      const contexts = this.contexts.slice(0, this.contexts.length - i);
      names.push(this.contextIdforContexts(contexts));
    }
    names.push('');
    this._currentContextIds = names;
  }

  private contextIdforContexts(contexts: ExecutionContextId[]) {
    return contexts ?
        contexts
            .map(
                context => (context.id === 0 && context.iterationId === 0) ?
                    '' :
                    `${context.frameName}-${context.iterationId}`)
            .join('/') :
        '';
  }

  /**
   * Enter a new frame, a new context is pushed on the current context list.
   * @param frameId new frame id
   */
  enterFrame(frameId: string) {
    if (this.contexts) {
      this.lastId++;
      this.contexts = this.contexts.slice();
      this.contexts.push(this.newFrame(this.lastId, frameId));
      this._currentContextIds.unshift(this.contextIdforContexts(this.contexts));
    }
  }

  /**
   * Exit the current frame, the last context is removed from the current
   * context list.
   */
  exitFrame() {
    if (this.contexts && this.contexts.length > 1) {
      this.contexts = this.contexts.slice();
      this.contexts.splice(-1);
      this.currentContextIds.shift();
    } else {
      throw new Error('Cannot exit frame, the context is empty');
    }
  }

  /**
   * Enter the next iteration of a loop, the iteration id of last context is
   * increased.
   */
  nextIteration() {
    if (this.contexts && this.contexts.length > 0) {
      this.contexts = this.contexts.slice();
      this.lastId++;
      const context =
          Object.assign({}, this.contexts[this.contexts.length - 1]) as
          ExecutionContextId;
      context.iterationId += 1;
      context.id = this.lastId;
      this.contexts.splice(-1, 1, context);
      this._currentContextIds.splice(
          0, 1, this.contextIdforContexts(this.contexts));
    } else {
      throw new Error('Cannot increase frame iteration, the context is empty');
    }
  }

  getWeight(name: string): Tensor[] {
    return this.weightMap[name];
  }
}
