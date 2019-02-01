
### ng-proto
This package allows you to quickly edit angular templates without lengthy rebuild times. Currently, fast reloading only works with css files.
For use with Angular CLI version 6+

```
npm install -g ng-proto
```

To run, use the ng-proto command anywhere in your project directory, or: 
```
ng-proto ./angular_project_directory
```

```
Or if your project is already built, specify the dist directory:
```
ng-proto -d ./dist
```

Specify additional options to ng build with -o: 
```
ng-proto -o --i18nFile=i18nFile

ng-proto uses your build outputs styles.css to update global styles, and vendor.js to insert some code into the client, so make sure if you build manually or change any build options that your output includes both of these files unminified. 



