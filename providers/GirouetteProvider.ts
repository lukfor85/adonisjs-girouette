import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import Metadata from '../src/Types/Metadata'

export default class GirouetteProvider {
  public static needsApplication = true

  constructor(protected app: ApplicationContract) {}

  public register() {
    this.app.container.singleton('SoftwareCitadel/Girouette', () => {
      const { Middleware } = require('../src/Decorators/Middleware')
      const { Get, Post, Put, Patch, Delete } = require('../src/Decorators/RouteDecorators')
      const { Where } = require('../src/Decorators/Where')
      const { Resource } = require('../src/Decorators/Resource')

      return {
        Middleware,
        Get,
        Post,
        Put,
        Patch,
        Delete,
        Where,
        Resource,
      }
    })
  }

  public async boot() {
    const Route = this.app.container.use('Adonis/Core/Route')
    const listOfHttpControllerPaths = this.getListOfHttpControllerPaths()

    for (const controllerPath of listOfHttpControllerPaths) {
      const { default: controller } = require(controllerPath)
      if (!controller) {
        continue
      }

      const resourcePattern = Reflect.getMetadata('__resource__', controller)
      if (resourcePattern) {
        const resource = Route.resource(resourcePattern, controller.name)
        const resourceName = Reflect.getMetadata('__resource_name__', controller)
        if (resourceName) {
          resource.as(resourceName)
        }
      }

      const routesMetadata = Reflect.getMetadata('__routes__', controller.prototype) as {
        [propertyKey: string]: Metadata
      }
      if (!routesMetadata) {
        continue
      }

      for (const [propertyKey, routeMetadata] of Object.entries(routesMetadata)) {
        const route = Route.route(
          routeMetadata.pattern,
          [routeMetadata.method],
          `${controller.name}.${propertyKey}`
        )

        if (routeMetadata.name) {
          route.as(routeMetadata.name)
        }

        if (routeMetadata.middleware) {
          for (const middleware of routeMetadata.middleware) {
            route.middleware(middleware)
          }
        }

        if (routeMetadata.where) {
          for (const where of routeMetadata.where) {
            route.where(where.key, where.matcher)
          }
        }
      }
    }
  }

  private getListOfHttpControllerPaths(): string[] {
    let httpControllerNamespace = this.app.namespacesMap.get('httpControllers')!

    for (const [key, value] of Object.entries(this.app.container.importAliases)) {
      if (httpControllerNamespace.startsWith(key)) {
        httpControllerNamespace = httpControllerNamespace.replace(key, value)
        break
      }
    }

    const controllerPaths = this.app.helpers
      .fsReadAll(httpControllerNamespace)
      .map((controller) => httpControllerNamespace + '/' + controller.replace('.ts', ''))

    return controllerPaths
  }
}
