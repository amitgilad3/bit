/** @flow */
import { BitObject } from '../objects';
import ComponentObjects from '../component-objects';
import Scope from '../scope';
import { allSettled } from '../../utils';
import { MergeConflict, ComponentNotFound } from '../exceptions';
import Component from '../models/component';
import ComponentVersion from '../component-version';
import Version from '../models/version';
import Source from '../models/source';
import { BitId, BitIds } from '../../bit-id';
import type { ComponentProps } from '../models/component';
import type { ResultObject } from '../../utils/promise-to-result-object';

export type ComponentTree = {
  component: Component;
  objects: BitObject[];
};

export default class SourceRepository {
  scope: Scope;  

  constructor(scope: Scope) {
    this.scope = scope;
  }

  objects() {
    return this.scope.objects;
  }

  findComponent(component: Component): Promise<Component> {
    return this.objects()
      .findOne(component.hash())
      .catch(() => null);
  }


  getComponent(bitId: BitId): Promise<ComponentVersion> {
    return this.get(bitId).then((component) => {
      if (!component) throw new ComponentNotFound();
      const versionNum = bitId.getVersion().resolve(component.listVersions());
      return component.loadVersion(versionNum, this.objects())
        .then(() => new ComponentVersion(
          component,
          versionNum,
          this.scope.name()
        ));
    });
  }
  
  get(bitId: BitId): Promise<Component> {
    return this.findComponent(Component.fromBitId(bitId));
  }

  getMany(ids: BitIds): Promise<ResultObject[]> {
    return allSettled(ids.map(id => this.get(id)));
  }

  getObjects(id: BitId): Promise<ComponentObjects> {
    return this.get(id).then((component) => {
      if (!component) throw new ComponentNotFound();
      return component.collectObjects(this.objects());
    });
  }

  findOrAddComponent(props: ComponentProps): Promise<Component> {
    const comp = Component.from(props);
    return this.findComponent(comp)
      .then((component) => {
        if (!component) return comp;
        return component;
      });
  }

  addSource(source: any, dependencies: ComponentVersion[]): Promise<Component> {
    dependencies = dependencies.map(dep => dep.toId());
    const objectRepo = this.objects();
    return this.findOrAddComponent(source)
      .then((component) => {
        const impl = Source.from(Buffer.from(source.impl.src));
        const specs = source.specs ? Source.from(Buffer.from(source.specs.src)): null;
        const version = Version.fromComponent(source, impl, specs, dependencies);
        component.addVersion(version);
        
        objectRepo
          .add(version)
          .add(component)
          .add(impl)
          .add(specs);
        
        return component;
      });
  }

  put({ component, objects }: ComponentTree) {
    const repo = this.objects();
    repo.add(component);
    objects.forEach(obj => repo.add(obj));
    return component;
  }

  clean(bitId: BitId) {
    return this.get(bitId)
      .then(component => component.remove(this.objects()));
  }

  merge({ component, objects }: ComponentTree): Promise<Component> {
    return this.findComponent(component).then((existingComponent) => {
      if (!existingComponent || component.compare(existingComponent)) {
        return this.put({ component, objects });
      }
      
      throw new MergeConflict();
    });
  }
}